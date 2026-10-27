import sys, json, ast, io, time, types, base64

USER_CODE = base64.b64decode("__AL_USER_CODE_B64__").decode("utf-8")
INPUT_DATA = __AL_INPUT_DATA__
MAX_STEPS = 800
MAX_SECONDS = 4.0
SIZE_BUDGET = 78000
STEP_BYTES = [0]
FILENAME = "<algolens>"
MARK = "__CODEREEL_TRACE__"
END = "__CODEREEL_END__"
CODE_LINES = USER_CODE.splitlines()
OUTPUTS = []
STEP_START = [0.0]
TRUNCATED = [False]
PREV = {}
INJECTED = set()
STEPS = []


class Capture(io.TextIOBase):
    def __init__(self):
        self.buf = ""

    def writable(self):
        return True

    def write(self, s):
        if not isinstance(s, str):
            s = str(s)
        self.buf += s
        while "\n" in self.buf:
            line, self.buf = self.buf.split("\n", 1)
            OUTPUTS.append(line)
        return len(s)

    def flush(self):
        if self.buf:
            OUTPUTS.append(self.buf)


def brief(value, limit=90):
    try:
        if is_tree(value):
            text = "TreeNode(%s)" % level_order(value)
        elif is_list_node(value):
            text = "ListNode(%s)" % list_values(value)
        elif isinstance(value, str):
            text = json.dumps(value)
        else:
            text = repr(value)
    except Exception:
        text = "<unreadable>"
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 3] + "..."


def level_order(node, limit=60):
    values = []
    queue = [node]
    guard = 0
    while queue and guard < limit:
        cur = queue.pop(0)
        if cur is None:
            values.append(None)
            continue
        values.append(json_safe(attr(cur, "val")))
        queue.append(attr(cur, "left"))
        queue.append(attr(cur, "right"))
        guard += 1
    while values and values[-1] is None:
        values.pop()
    return values


def py_type(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    if isinstance(value, list):
        return "list"
    if isinstance(value, tuple):
        return "tuple"
    if isinstance(value, dict):
        return "dict"
    if isinstance(value, set):
        return "set"
    if isinstance(value, (types.FunctionType, types.BuiltinFunctionType, types.MethodType)):
        return "function"
    if isinstance(value, type):
        return "class"
    if isinstance(value, types.ModuleType):
        return "module"
    if is_tree(value):
        return "TreeNode"
    if is_list_node(value):
        return "ListNode"
    return type(value).__name__


def is_tree(value):
    if isinstance(value, dict):
        return "val" in value and ("left" in value or "right" in value)
    return hasattr(value, "val") and (hasattr(value, "left") or hasattr(value, "right"))


def is_list_node(value):
    if isinstance(value, dict):
        return "val" in value and "next" in value and "left" not in value and "right" not in value
    return (
        hasattr(value, "val")
        and hasattr(value, "next")
        and not hasattr(value, "left")
        and not hasattr(value, "right")
    )


def attr(value, name):
    if isinstance(value, dict):
        return value.get(name)
    return getattr(value, name, None)


def tree_snapshot(node, depth=0, seen=None, counter=None):
    if node is None or depth > 12:
        return None
    visited = seen if seen is not None else set()
    if id(node) in visited:
        return None
    visited.add(id(node))
    ctr = counter if counter is not None else [0]
    ctr[0] += 1
    left = attr(node, "left")
    right = attr(node, "right")
    snap = {"val": json_safe(attr(node, "val")), "id": ctr[0]}
    if left is not None:
        snap["left"] = tree_snapshot(left, depth + 1, visited, ctr)
    if right is not None:
        snap["right"] = tree_snapshot(right, depth + 1, visited, ctr)
    return snap


def list_values(node):
    values = []
    seen = set()
    cur = node
    guard = 0
    while cur is not None and guard < 200 and id(cur) not in seen:
        seen.add(id(cur))
        values.append(json_safe(attr(cur, "val")))
        cur = attr(cur, "next")
        guard += 1
    return values


def list_refs(node):
    refs = []
    seen = set()
    cur = node
    guard = 0
    while cur is not None and guard < 200 and id(cur) not in seen:
        seen.add(id(cur))
        refs.append(cur)
        cur = attr(cur, "next")
        guard += 1
    return refs


def json_safe(value, depth=0, seen=None):
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        return value if value == value and value not in (float("inf"), float("-inf")) else str(value)
    if depth > 5:
        return "..."
    visited = seen if seen is not None else set()
    if id(value) in visited:
        return "[Circular]"
    visited.add(id(value))
    try:
        if isinstance(value, (list, tuple)):
            return [json_safe(v, depth + 1, visited) for v in list(value)[:120]]
        if isinstance(value, set):
            return {
                "__kind": "set",
                "values": [json_safe(v, depth + 1, visited) for v in list(value)[:120]],
            }
        if isinstance(value, dict):
            if is_tree(value):
                return {"__kind": "tree", "data": tree_snapshot(value)}
            if is_list_node(value):
                return {"__kind": "list", "values": list_values(value)}
            return {
                "__kind": "map",
                "entries": [[brief(k, 40), json_safe(v, depth + 1, visited)] for k, v in list(value.items())[:120]],
            }
        if is_tree(value):
            return {"__kind": "tree", "data": tree_snapshot(value)}
        if is_list_node(value):
            return {"__kind": "list", "values": list_values(value)}
        if isinstance(value, (types.FunctionType, types.BuiltinFunctionType, types.MethodType)):
            return "fn %s()" % getattr(value, "__name__", "anonymous")
        if isinstance(value, types.ModuleType):
            return "<module %s>" % value.__name__
        if isinstance(value, type):
            return "<class %s>" % value.__name__
        return brief(value, 120)
    finally:
        visited.discard(id(value))


POINTER_NAMES = set(
    "i j k l r c m n p q x y left right lo hi low high mid middle start end slow fast head tail curr cur current prev next row col r1 c1 r2 c2 first last begin finish idx index ptr pos".split()
)


def detect_structures(values):
    items = [(k, v) for k, v in values if not k.startswith("_") and k != "self" and k not in INJECTED]
    views = []

    numeric = {}
    for name, value in items:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            if 0 <= value < 1000 and name in POINTER_NAMES:
                numeric[name] = int(value)

    for name, value in items:
        if is_tree(value):
            snap = tree_snapshot(value)
            if snap:
                views.append(
                    {
                        "kind": "tree",
                        "name": name,
                        "root": snap,
                        "note": "Binary tree - recursive left/right structure",
                    }
                )
                break

    best_list = None
    for name, value in items:
        if not is_list_node(value):
            continue
        nodes = list_values(value)
        refs = list_refs(value)
        pointers = {}
        for other_name, other_value in items:
            for idx, ref in enumerate(refs):
                if other_value is ref:
                    pointers[other_name] = idx
                    break
        candidate = {
            "kind": "list",
            "name": name,
            "nodes": [{"val": v} for v in nodes],
            "pointers": pointers,
            "note": "Linked list - follow next pointers",
        }
        if best_list is None or len(candidate["nodes"]) > len(best_list["nodes"]):
            best_list = candidate
    if best_list:
        views.append(best_list)

    matrix_candidate = None
    for name, value in items:
        if isinstance(value, (list, tuple)) and len(value) > 0 and all(
            isinstance(row, (list, tuple)) for row in value
        ):
            matrix_candidate = (name, value)
            break
    if matrix_candidate:
        name, value = matrix_candidate
        rows = [[json_safe(cell) for cell in list(row)[:40]] for row in list(value)[:40]]
        row_count = len(rows)
        col_count = max((len(r) for r in rows), default=0)
        pointers = {}
        for pname, idx in numeric.items():
            if pname in ("i", "row", "r") and idx >= row_count:
                continue
            if pname in ("j", "col", "c") and idx >= col_count:
                continue
            pointers[pname] = idx
        labels = {}
        row_var = next(((n, v) for n, v in items if isinstance(v, int) and n in ("i", "row", "r")), None)
        col_var = next(((n, v) for n, v in items if isinstance(v, int) and n in ("j", "col", "c")), None)
        if row_var and col_var and 0 <= row_var[1] < row_count and 0 <= col_var[1] < col_count:
            labels["%s, %s" % (row_var[0], col_var[0])] = [row_var[1], col_var[1]]
        views.append(
            {
                "kind": "matrix",
                "name": name,
                "values": rows,
                "pointers": pointers,
                "pointerLabels": labels,
                "note": "Grid / 2D matrix - active cell tracked by (row, col)",
            }
        )

    map_candidate = None
    for name, value in items:
        if isinstance(value, dict) and not is_tree(value) and not is_list_node(value):
            map_candidate = (name, value)
            break
    if map_candidate:
        name, value = map_candidate
        views.append(
            {
                "kind": "map",
                "name": name,
                "entries": [{"key": brief(k, 40), "value": brief(v, 40)} for k, v in list(value.items())[:60]],
                "note": "Hash map / dictionary",
            }
        )

    set_candidate = None
    for name, value in items:
        if isinstance(value, set):
            set_candidate = (name, value)
            break
    if set_candidate:
        name, value = set_candidate
        views.append(
            {
                "kind": "set",
                "name": name,
                "values": [brief(v, 40) for v in list(value)[:60]],
                "note": "Hash set - unique values",
            }
        )

    for name, value in items:
        if isinstance(value, (list, tuple)) and name in ("stack", "st", "queue", "q", "dq"):
            views.append(
                {
                    "kind": "queue" if name in ("queue", "q", "dq") else "stack",
                    "name": name,
                    "values": [json_safe(v) for v in list(value)[-40:]],
                    "note": "FIFO - front is first element"
                    if name in ("queue", "q", "dq")
                    else "LIFO - top is last element",
                }
            )

    array_candidate = None
    for name, value in items:
        if isinstance(value, (list, tuple)) and not (
            len(value) > 0 and all(isinstance(row, (list, tuple)) for row in value)
        ):
            if name in ("stack", "st", "queue", "q", "dq"):
                continue
            if array_candidate is None or len(value) > len(array_candidate[1]):
                array_candidate = (name, value)
    if array_candidate:
        name, value = array_candidate
        pointers = {k: v for k, v in numeric.items() if v < len(value)}
        views.append(
            {
                "kind": "array",
                "name": name,
                "values": [json_safe(v) for v in list(value)[:120]],
                "pointers": pointers,
                "highlights": [],
                "note": "Array / list with live pointer tracking",
            }
        )
    return views


def snapshot(frame):
    local_items = [
        (k, v)
        for k, v in frame.f_locals.items()
        if not k.startswith("__") and k not in INJECTED and k != "self"
    ]
    global_items = [
        (k, v)
        for k, v in frame.f_globals.items()
        if k not in frame.f_locals
        and not k.startswith("__")
        and k not in INJECTED
        and k not in ("USER_CODE", "INPUT_DATA", "CODE_LINES", "OUTPUTS", "PREV", "STEPS")
    ]
    variables = []
    frame_key = id(frame)
    for name, value in local_items:
        display = brief(value)
        key = (frame_key, name)
        changed = key in PREV and PREV[key] != display
        PREV[key] = display
        variables.append(
            {
                "name": name,
                "value": None,
                "display": display,
                "type": py_type(value),
                "scope": "local",
                "changed": changed,
            }
        )
    for name, value in global_items:
        if isinstance(value, (types.ModuleType, types.FunctionType, types.BuiltinFunctionType, type)):
            continue
        display = brief(value)
        key = ("global", name)
        changed = key in PREV and PREV[key] != display
        PREV[key] = display
        variables.append(
            {
                "name": name,
                "value": None,
                "display": display,
                "type": py_type(value),
                "scope": "global",
                "changed": changed,
            }
        )
    return variables


def call_stack(frame):
    stack = []
    cur = frame
    while cur is not None:
        if cur.f_code.co_filename == FILENAME:
            stack.append({"name": cur.f_code.co_name, "line": cur.f_lineno})
        cur = cur.f_back
    stack.reverse()
    return stack


def line_text(line):
    if 0 < line <= len(CODE_LINES):
        return CODE_LINES[line - 1].strip()[:120]
    return "line %d" % line


def record(frame):
    step = {
        "line": frame.f_lineno,
        "source": line_text(frame.f_lineno),
        "variables": snapshot(frame),
        "callStack": call_stack(frame),
        "explanation": "%s :: %s" % (frame.f_code.co_name, line_text(frame.f_lineno)),
        "outputCount": len(OUTPUTS),
        "dataStructures": detect_structures(list(frame.f_locals.items())),
    }
    STEP_BYTES[0] += len(json.dumps(step, default=str)) + 2
    STEPS.append(step)


def tracer(frame, event, arg):
    if frame.f_code.co_filename != FILENAME:
        return None
    if event == "call":
        return tracer
    if event == "line":
        if len(STEPS) >= MAX_STEPS:
            TRUNCATED[0] = True
            raise RuntimeError("__CODEREEL_STEP_LIMIT__")
        if STEP_BYTES[0] > SIZE_BUDGET:
            TRUNCATED[0] = True
            raise RuntimeError("__CODEREEL_SIZE_LIMIT__")
        if time.time() - STEP_START[0] > MAX_SECONDS:
            TRUNCATED[0] = True
            raise RuntimeError("__CODEREEL_TIME_LIMIT__")
        record(frame)
    return tracer


def make_node(value, cls, with_next):
    if cls is not None:
        try:
            node = cls(value)
            if with_next and not hasattr(node, "next"):
                node.next = None
            return node
        except Exception:
            pass
    if with_next:
        return types.SimpleNamespace(val=value, next=None)
    return types.SimpleNamespace(val=value, left=None, right=None)


def build_tree(arr, cls):
    if not isinstance(arr, (list, tuple)) or not arr or arr[0] is None:
        return None
    root = make_node(arr[0], cls, False)
    queue = [root]
    idx = 1
    guard = 0
    while queue and idx < len(arr) and guard < 500:
        cur = queue.pop(0)
        guard += 1
        if arr[idx] is not None:
            cur.left = make_node(arr[idx], cls, False)
            queue.append(cur.left)
        idx += 1
        if idx < len(arr) and arr[idx] is not None:
            cur.right = make_node(arr[idx], cls, False)
            queue.append(cur.right)
        idx += 1
    return root


def build_list(arr, cls):
    if not isinstance(arr, (list, tuple)) or not arr:
        return None
    head = make_node(arr[0], cls, True)
    cur = head
    for value in arr[1:]:
        cur.next = make_node(value, cls, True)
        cur = cur.next
    return head


def coerce(name, value, namespace):
    if not isinstance(value, (list, tuple)):
        return value
    lower = name.lower()
    tree_cls = namespace.get("TreeNode") or namespace.get("Node")
    list_cls = namespace.get("ListNode") or namespace.get("Node")
    if lower in ("root", "tree", "node", "bst"):
        return build_tree(value, tree_cls)
    if lower in ("head", "list", "linkedlist", "l1", "l2"):
        return build_list(value, list_cls)
    return value


def argname(param):
    return getattr(param, "arg", None) or getattr(param, "name", "arg")


def build_args(params, input_data, namespace):
    names = [argname(p) for p in params]
    if input_data is None:
        return [], names
    if isinstance(input_data, dict):
        if isinstance(input_data.get("args"), list):
            values = input_data["args"]
            return [
                coerce(names[i] if i < len(names) else "arg%d" % i, v, namespace)
                for i, v in enumerate(values)
            ], names
        args = []
        for idx, name in enumerate(names):
            if name in input_data:
                args.append(coerce(name, input_data[name], namespace))
            else:
                vals = list(input_data.values())
                args.append(coerce(name, vals[idx], namespace) if idx < len(vals) else None)
        return args, names
    if isinstance(input_data, (list, tuple)):
        if len(names) == 1:
            return [coerce(names[0], input_data, namespace)], names
        if len(input_data) == len(names):
            return [coerce(names[i], input_data[i], namespace) for i in range(len(names))], names
        if names:
            return [coerce(names[0], input_data, namespace)] + [None] * (len(names) - 1), names
        return [], names
    return ([coerce(names[0] if names else "arg", input_data, namespace)] if names else []), names


def find_target(module_tree, namespace):
    if any(isinstance(node, (ast.If, ast.For, ast.While, ast.Try, ast.With)) for node in module_tree.body):
        return None, "", []
    if any(isinstance(node, ast.Expr) and isinstance(node.value, ast.Call) for node in module_tree.body):
        return None, "", []
    funcs = [n for n in module_tree.body if isinstance(n, ast.FunctionDef)]
    classes = [n for n in module_tree.body if isinstance(n, ast.ClassDef)]
    if funcs and not classes:
        target = funcs[-1]
        fn = namespace.get(target.name)
        if fn is not None:
            return fn, target.name, target.args.args
    for klass in classes:
        methods = [n for n in klass.body if isinstance(n, ast.FunctionDef) and not n.name.startswith("__")]
        if not methods:
            continue
        klass_obj = namespace.get(klass.name)
        if klass_obj is None:
            continue
        method = methods[-1]
        try:
            instance = klass_obj()
        except Exception:
            continue
        fn = getattr(instance, method.name, None)
        if fn is not None:
            params = [a for a in method.args.args if a.arg != "self"]
            return fn, "%s.%s" % (klass.name, method.name), params
    return None, "", []


def ast_nodes(module_tree):
    category = {
        "For": "loop",
        "AsyncFor": "loop",
        "While": "loop",
        "If": "conditional",
        "Assign": "declaration",
        "AnnAssign": "declaration",
        "AugAssign": "declaration",
        "FunctionDef": "function",
        "AsyncFunctionDef": "function",
        "Lambda": "function",
        "Call": "call",
    }
    nodes = []
    for node in ast.walk(module_tree):
        name = type(node).__name__
        if name in ("Module", "Expr", "arguments", "arg", "Load", "Store", "Add", "Sub", "Mult", "Div"):
            continue
        line = getattr(node, "lineno", 0)
        if not line:
            continue
        try:
            details = ast.unparse(node)[:70]
        except Exception:
            details = name
        nodes.append({"type": name, "category": category.get(name, "other"), "line": line, "details": details})
        if len(nodes) >= 200:
            break
    return nodes


def main():
    payload = {
        "steps": [],
        "outputs": OUTPUTS,
        "error": None,
        "truncated": False,
        "entryPoint": "",
        "returnValue": None,
        "finalStructures": [],
        "astNodes": [],
        "elapsedMs": 0,
    }
    try:
        module_tree = ast.parse(USER_CODE, filename=FILENAME)
        payload["astNodes"] = ast_nodes(module_tree)
    except SyntaxError as exc:
        payload["error"] = "SyntaxError: %s (line %s)" % (exc.msg, exc.lineno)
        payload["steps"] = [
            {
                "line": exc.lineno or 1,
                "variables": [],
                "callStack": [],
                "explanation": payload["error"],
                "isError": True,
                "errorMessage": payload["error"],
                "outputCount": 0,
            }
        ]
        return payload

    namespace = {"__name__": "__main__", "__builtins__": __builtins__}
    try:
        exec("from typing import *\nfrom collections import *\n", namespace)
        INJECTED.update(namespace.keys())
    except Exception:
        pass

    STEP_START[0] = time.time()
    real_stdout = sys.stdout
    capture = Capture()
    sys.stdout = capture
    target = None
    target_name = ""
    target_args = []
    return_value = None
    try:
        sys.settrace(tracer)
        try:
            body = list(module_tree.body)
            trailing = None
            if body and isinstance(body[-1], ast.Expr) and not isinstance(
                body[-1].value, (ast.Constant, ast.JoinedStr)
            ):
                trailing = body.pop()
            exec_tree = ast.Module(body=body, type_ignores=[])
            ast.fix_missing_locations(exec_tree)
            exec(compile(exec_tree, FILENAME, "exec"), namespace)
            if trailing is not None:
                expr = ast.Expression(body=trailing.value)
                ast.fix_missing_locations(expr)
                try:
                    payload["entryPoint"] = ast.unparse(trailing.value)[:80]
                except Exception:
                    pass
                return_value = eval(compile(expr, FILENAME, "eval"), namespace)
            else:
                target, target_name, target_args = find_target(module_tree, namespace)
                if target is not None:
                    args, _names = build_args(target_args, INPUT_DATA, namespace)
                    payload["entryPoint"] = "%s(%s)" % (target_name, ", ".join(brief(a, 30) for a in args))
                    return_value = target(*args)
        finally:
            sys.settrace(None)
    except SyntaxError as exc:
        payload["error"] = "SyntaxError: %s (line %s)" % (exc.msg, exc.lineno)
    except RuntimeError as exc:
        message = str(exc)
        if message == "__CODEREEL_STEP_LIMIT__":
            payload["error"] = "Execution stopped after %d steps (possible infinite loop)." % MAX_STEPS
            payload["truncated"] = True
        elif message == "__CODEREEL_TIME_LIMIT__":
            payload["error"] = "Execution stopped after %.1fs (possible infinite loop)." % MAX_SECONDS
            payload["truncated"] = True
        elif message == "__CODEREEL_SIZE_LIMIT__":
            payload["error"] = "Trace stopped after %d steps to stay within the sandbox output limit." % len(STEPS)
            payload["truncated"] = True
        else:
            payload["error"] = "RuntimeError: %s" % message
    except RecursionError:
        payload["error"] = "RecursionError: maximum recursion depth exceeded."
    except Exception as exc:
        line = None
        tb = exc.__traceback__
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == FILENAME:
                line = tb.tb_lineno
            tb = tb.tb_next
        payload["error"] = "%s: %s" % (type(exc).__name__, exc)
        payload["errorLine"] = line
    finally:
        sys.stdout = real_stdout
        capture.flush()

    payload["steps"] = STEPS
    payload["truncated"] = payload["truncated"] or TRUNCATED[0]
    payload["elapsedMs"] = round((time.time() - STEP_START[0]) * 1000, 2)
    if payload["error"] and STEPS:
        message = payload["error"]
        last = STEPS[-1]
        payload["steps"].append(
            {
                "line": payload.get("errorLine") or last["line"],
                "variables": last["variables"],
                "callStack": last["callStack"],
                "explanation": "Runtime error: " + message,
                "isError": True,
                "errorMessage": message,
                "outputCount": len(OUTPUTS),
            }
        )
    elif not payload["error"]:
        if return_value is not None:
            payload["returnValue"] = {
                "name": "return",
                "value": json_safe(return_value),
                "display": brief(return_value, 120),
                "type": py_type(return_value),
            }
        value_structures = detect_structures([("return", return_value)]) if return_value is not None else []
        namespace_structures = detect_structures(list(namespace.items()))
        merged = []
        seen = set()
        for view in value_structures + namespace_structures:
            key = (view["kind"], view["name"])
            if key in seen:
                continue
            seen.add(key)
            merged.append(view)
        payload["finalStructures"] = merged[:8]
        if STEPS:
            last = STEPS[-1]
            STEPS.append(
                {
                    "line": last["line"],
                    "source": last.get("source", ""),
                    "variables": last["variables"],
                    "callStack": [],
                    "explanation": "Program finished - returned %s" % brief(return_value, 80)
                    if return_value is not None
                    else "Program finished",
                    "outputCount": len(OUTPUTS),
                    "returnValue": payload["returnValue"],
                    "dataStructures": payload["finalStructures"],
                }
            )
        elif return_value is not None:
            STEPS.append(
                {
                    "line": 1,
                    "variables": [],
                    "callStack": [],
                    "explanation": "Program finished - returned %s" % brief(return_value, 80),
                    "outputCount": len(OUTPUTS),
                    "returnValue": payload["returnValue"],
                    "dataStructures": payload["finalStructures"],
                }
            )
    payload["outputs"] = OUTPUTS
    return payload


payload = main()
encoded = json.dumps(payload, ensure_ascii=False, default=str)
sys.stdout.write("\n" + MARK + encoded + END + "\n")
