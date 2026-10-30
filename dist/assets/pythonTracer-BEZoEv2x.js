import{runSandbox as e}from"./wandboxRunner-DxvsWZ1u.js";var t=`import sys, json, ast, io, time, types, base64\r
\r
USER_CODE = base64.b64decode("__AL_USER_CODE_B64__").decode("utf-8")\r
INPUT_DATA = __AL_INPUT_DATA__\r
MAX_STEPS = 800\r
MAX_SECONDS = 4.0\r
SIZE_BUDGET = 78000\r
STEP_BYTES = [0]\r
FILENAME = "<algolens>"\r
MARK = "__CODEREEL_TRACE__"\r
END = "__CODEREEL_END__"\r
CODE_LINES = USER_CODE.splitlines()\r
OUTPUTS = []\r
STEP_START = [0.0]\r
TRUNCATED = [False]\r
PREV = {}\r
INJECTED = set()\r
STEPS = []\r
\r
\r
class Capture(io.TextIOBase):\r
    def __init__(self):\r
        self.buf = ""\r
\r
    def writable(self):\r
        return True\r
\r
    def write(self, s):\r
        if not isinstance(s, str):\r
            s = str(s)\r
        self.buf += s\r
        while "\\n" in self.buf:\r
            line, self.buf = self.buf.split("\\n", 1)\r
            OUTPUTS.append(line)\r
        return len(s)\r
\r
    def flush(self):\r
        if self.buf:\r
            OUTPUTS.append(self.buf)\r
\r
\r
def brief(value, limit=90):\r
    try:\r
        if is_tree(value):\r
            text = "TreeNode(%s)" % level_order(value)\r
        elif is_list_node(value):\r
            text = "ListNode(%s)" % list_values(value)\r
        elif isinstance(value, str):\r
            text = json.dumps(value)\r
        else:\r
            text = repr(value)\r
    except Exception:\r
        text = "<unreadable>"\r
    text = " ".join(text.split())\r
    return text if len(text) <= limit else text[: limit - 3] + "..."\r
\r
\r
def level_order(node, limit=60):\r
    values = []\r
    queue = [node]\r
    guard = 0\r
    while queue and guard < limit:\r
        cur = queue.pop(0)\r
        if cur is None:\r
            values.append(None)\r
            continue\r
        values.append(json_safe(attr(cur, "val")))\r
        queue.append(attr(cur, "left"))\r
        queue.append(attr(cur, "right"))\r
        guard += 1\r
    while values and values[-1] is None:\r
        values.pop()\r
    return values\r
\r
\r
def py_type(value):\r
    if value is None:\r
        return "null"\r
    if isinstance(value, bool):\r
        return "bool"\r
    if isinstance(value, int):\r
        return "int"\r
    if isinstance(value, float):\r
        return "float"\r
    if isinstance(value, str):\r
        return "str"\r
    if isinstance(value, list):\r
        return "list"\r
    if isinstance(value, tuple):\r
        return "tuple"\r
    if isinstance(value, dict):\r
        return "dict"\r
    if isinstance(value, set):\r
        return "set"\r
    if isinstance(value, (types.FunctionType, types.BuiltinFunctionType, types.MethodType)):\r
        return "function"\r
    if isinstance(value, type):\r
        return "class"\r
    if isinstance(value, types.ModuleType):\r
        return "module"\r
    if is_tree(value):\r
        return "TreeNode"\r
    if is_list_node(value):\r
        return "ListNode"\r
    return type(value).__name__\r
\r
\r
def is_tree(value):\r
    if isinstance(value, dict):\r
        return "val" in value and ("left" in value or "right" in value)\r
    return hasattr(value, "val") and (hasattr(value, "left") or hasattr(value, "right"))\r
\r
\r
def is_list_node(value):\r
    if isinstance(value, dict):\r
        return "val" in value and "next" in value and "left" not in value and "right" not in value\r
    return (\r
        hasattr(value, "val")\r
        and hasattr(value, "next")\r
        and not hasattr(value, "left")\r
        and not hasattr(value, "right")\r
    )\r
\r
\r
def attr(value, name):\r
    if isinstance(value, dict):\r
        return value.get(name)\r
    return getattr(value, name, None)\r
\r
\r
def tree_snapshot(node, depth=0, seen=None, counter=None):\r
    if node is None or depth > 12:\r
        return None\r
    visited = seen if seen is not None else set()\r
    if id(node) in visited:\r
        return None\r
    visited.add(id(node))\r
    ctr = counter if counter is not None else [0]\r
    ctr[0] += 1\r
    left = attr(node, "left")\r
    right = attr(node, "right")\r
    snap = {"val": json_safe(attr(node, "val")), "id": ctr[0]}\r
    if left is not None:\r
        snap["left"] = tree_snapshot(left, depth + 1, visited, ctr)\r
    if right is not None:\r
        snap["right"] = tree_snapshot(right, depth + 1, visited, ctr)\r
    return snap\r
\r
\r
def list_values(node):\r
    values = []\r
    seen = set()\r
    cur = node\r
    guard = 0\r
    while cur is not None and guard < 200 and id(cur) not in seen:\r
        seen.add(id(cur))\r
        values.append(json_safe(attr(cur, "val")))\r
        cur = attr(cur, "next")\r
        guard += 1\r
    return values\r
\r
\r
def list_refs(node):\r
    refs = []\r
    seen = set()\r
    cur = node\r
    guard = 0\r
    while cur is not None and guard < 200 and id(cur) not in seen:\r
        seen.add(id(cur))\r
        refs.append(cur)\r
        cur = attr(cur, "next")\r
        guard += 1\r
    return refs\r
\r
\r
def json_safe(value, depth=0, seen=None):\r
    if value is None or isinstance(value, (bool, int, str)):\r
        return value\r
    if isinstance(value, float):\r
        return value if value == value and value not in (float("inf"), float("-inf")) else str(value)\r
    if depth > 5:\r
        return "..."\r
    visited = seen if seen is not None else set()\r
    if id(value) in visited:\r
        return "[Circular]"\r
    visited.add(id(value))\r
    try:\r
        if isinstance(value, (list, tuple)):\r
            return [json_safe(v, depth + 1, visited) for v in list(value)[:120]]\r
        if isinstance(value, set):\r
            return {\r
                "__kind": "set",\r
                "values": [json_safe(v, depth + 1, visited) for v in list(value)[:120]],\r
            }\r
        if isinstance(value, dict):\r
            if is_tree(value):\r
                return {"__kind": "tree", "data": tree_snapshot(value)}\r
            if is_list_node(value):\r
                return {"__kind": "list", "values": list_values(value)}\r
            return {\r
                "__kind": "map",\r
                "entries": [[brief(k, 40), json_safe(v, depth + 1, visited)] for k, v in list(value.items())[:120]],\r
            }\r
        if is_tree(value):\r
            return {"__kind": "tree", "data": tree_snapshot(value)}\r
        if is_list_node(value):\r
            return {"__kind": "list", "values": list_values(value)}\r
        if isinstance(value, (types.FunctionType, types.BuiltinFunctionType, types.MethodType)):\r
            return "fn %s()" % getattr(value, "__name__", "anonymous")\r
        if isinstance(value, types.ModuleType):\r
            return "<module %s>" % value.__name__\r
        if isinstance(value, type):\r
            return "<class %s>" % value.__name__\r
        return brief(value, 120)\r
    finally:\r
        visited.discard(id(value))\r
\r
\r
POINTER_NAMES = set(\r
    "i j k l r c m n p q x y left right lo hi low high mid middle start end slow fast head tail curr cur current prev next row col r1 c1 r2 c2 first last begin finish idx index ptr pos".split()\r
)\r
\r
\r
def detect_structures(values):\r
    items = [(k, v) for k, v in values if not k.startswith("_") and k != "self" and k not in INJECTED]\r
    views = []\r
\r
    numeric = {}\r
    for name, value in items:\r
        if isinstance(value, (int, float)) and not isinstance(value, bool):\r
            if 0 <= value < 1000 and name in POINTER_NAMES:\r
                numeric[name] = int(value)\r
\r
    for name, value in items:\r
        if is_tree(value):\r
            snap = tree_snapshot(value)\r
            if snap:\r
                views.append(\r
                    {\r
                        "kind": "tree",\r
                        "name": name,\r
                        "root": snap,\r
                        "note": "Binary tree - recursive left/right structure",\r
                    }\r
                )\r
                break\r
\r
    best_list = None\r
    for name, value in items:\r
        if not is_list_node(value):\r
            continue\r
        nodes = list_values(value)\r
        refs = list_refs(value)\r
        pointers = {}\r
        for other_name, other_value in items:\r
            for idx, ref in enumerate(refs):\r
                if other_value is ref:\r
                    pointers[other_name] = idx\r
                    break\r
        candidate = {\r
            "kind": "list",\r
            "name": name,\r
            "nodes": [{"val": v} for v in nodes],\r
            "pointers": pointers,\r
            "note": "Linked list - follow next pointers",\r
        }\r
        if best_list is None or len(candidate["nodes"]) > len(best_list["nodes"]):\r
            best_list = candidate\r
    if best_list:\r
        views.append(best_list)\r
\r
    matrix_candidate = None\r
    for name, value in items:\r
        if isinstance(value, (list, tuple)) and len(value) > 0 and all(\r
            isinstance(row, (list, tuple)) for row in value\r
        ):\r
            matrix_candidate = (name, value)\r
            break\r
    if matrix_candidate:\r
        name, value = matrix_candidate\r
        rows = [[json_safe(cell) for cell in list(row)[:40]] for row in list(value)[:40]]\r
        row_count = len(rows)\r
        col_count = max((len(r) for r in rows), default=0)\r
        pointers = {}\r
        for pname, idx in numeric.items():\r
            if pname in ("i", "row", "r") and idx >= row_count:\r
                continue\r
            if pname in ("j", "col", "c") and idx >= col_count:\r
                continue\r
            pointers[pname] = idx\r
        labels = {}\r
        row_var = next(((n, v) for n, v in items if isinstance(v, int) and n in ("i", "row", "r")), None)\r
        col_var = next(((n, v) for n, v in items if isinstance(v, int) and n in ("j", "col", "c")), None)\r
        if row_var and col_var and 0 <= row_var[1] < row_count and 0 <= col_var[1] < col_count:\r
            labels["%s, %s" % (row_var[0], col_var[0])] = [row_var[1], col_var[1]]\r
        views.append(\r
            {\r
                "kind": "matrix",\r
                "name": name,\r
                "values": rows,\r
                "pointers": pointers,\r
                "pointerLabels": labels,\r
                "note": "Grid / 2D matrix - active cell tracked by (row, col)",\r
            }\r
        )\r
\r
    map_candidate = None\r
    for name, value in items:\r
        if isinstance(value, dict) and not is_tree(value) and not is_list_node(value):\r
            map_candidate = (name, value)\r
            break\r
    if map_candidate:\r
        name, value = map_candidate\r
        views.append(\r
            {\r
                "kind": "map",\r
                "name": name,\r
                "entries": [{"key": brief(k, 40), "value": brief(v, 40)} for k, v in list(value.items())[:60]],\r
                "note": "Hash map / dictionary",\r
            }\r
        )\r
\r
    set_candidate = None\r
    for name, value in items:\r
        if isinstance(value, set):\r
            set_candidate = (name, value)\r
            break\r
    if set_candidate:\r
        name, value = set_candidate\r
        views.append(\r
            {\r
                "kind": "set",\r
                "name": name,\r
                "values": [brief(v, 40) for v in list(value)[:60]],\r
                "note": "Hash set - unique values",\r
            }\r
        )\r
\r
    for name, value in items:\r
        if isinstance(value, (list, tuple)) and name in ("stack", "st", "queue", "q", "dq"):\r
            views.append(\r
                {\r
                    "kind": "queue" if name in ("queue", "q", "dq") else "stack",\r
                    "name": name,\r
                    "values": [json_safe(v) for v in list(value)[-40:]],\r
                    "note": "FIFO - front is first element"\r
                    if name in ("queue", "q", "dq")\r
                    else "LIFO - top is last element",\r
                }\r
            )\r
\r
    array_candidate = None\r
    for name, value in items:\r
        if isinstance(value, (list, tuple)) and not (\r
            len(value) > 0 and all(isinstance(row, (list, tuple)) for row in value)\r
        ):\r
            if name in ("stack", "st", "queue", "q", "dq"):\r
                continue\r
            if array_candidate is None or len(value) > len(array_candidate[1]):\r
                array_candidate = (name, value)\r
    if array_candidate:\r
        name, value = array_candidate\r
        pointers = {k: v for k, v in numeric.items() if v < len(value)}\r
        views.append(\r
            {\r
                "kind": "array",\r
                "name": name,\r
                "values": [json_safe(v) for v in list(value)[:120]],\r
                "pointers": pointers,\r
                "highlights": [],\r
                "note": "Array / list with live pointer tracking",\r
            }\r
        )\r
    return views\r
\r
\r
def snapshot(frame):\r
    local_items = [\r
        (k, v)\r
        for k, v in frame.f_locals.items()\r
        if not k.startswith("__") and k not in INJECTED and k != "self"\r
    ]\r
    global_items = [\r
        (k, v)\r
        for k, v in frame.f_globals.items()\r
        if k not in frame.f_locals\r
        and not k.startswith("__")\r
        and k not in INJECTED\r
        and k not in ("USER_CODE", "INPUT_DATA", "CODE_LINES", "OUTPUTS", "PREV", "STEPS")\r
    ]\r
    variables = []\r
    frame_key = id(frame)\r
    for name, value in local_items:\r
        display = brief(value)\r
        key = (frame_key, name)\r
        changed = key in PREV and PREV[key] != display\r
        PREV[key] = display\r
        variables.append(\r
            {\r
                "name": name,\r
                "value": None,\r
                "display": display,\r
                "type": py_type(value),\r
                "scope": "local",\r
                "changed": changed,\r
            }\r
        )\r
    for name, value in global_items:\r
        if isinstance(value, (types.ModuleType, types.FunctionType, types.BuiltinFunctionType, type)):\r
            continue\r
        display = brief(value)\r
        key = ("global", name)\r
        changed = key in PREV and PREV[key] != display\r
        PREV[key] = display\r
        variables.append(\r
            {\r
                "name": name,\r
                "value": None,\r
                "display": display,\r
                "type": py_type(value),\r
                "scope": "global",\r
                "changed": changed,\r
            }\r
        )\r
    return variables\r
\r
\r
def call_stack(frame):\r
    stack = []\r
    cur = frame\r
    while cur is not None:\r
        if cur.f_code.co_filename == FILENAME:\r
            stack.append({"name": cur.f_code.co_name, "line": cur.f_lineno})\r
        cur = cur.f_back\r
    stack.reverse()\r
    return stack\r
\r
\r
def line_text(line):\r
    if 0 < line <= len(CODE_LINES):\r
        return CODE_LINES[line - 1].strip()[:120]\r
    return "line %d" % line\r
\r
\r
def record(frame):\r
    step = {\r
        "line": frame.f_lineno,\r
        "source": line_text(frame.f_lineno),\r
        "variables": snapshot(frame),\r
        "callStack": call_stack(frame),\r
        "explanation": "%s :: %s" % (frame.f_code.co_name, line_text(frame.f_lineno)),\r
        "outputCount": len(OUTPUTS),\r
        "dataStructures": detect_structures(list(frame.f_locals.items())),\r
    }\r
    STEP_BYTES[0] += len(json.dumps(step, default=str)) + 2\r
    STEPS.append(step)\r
\r
\r
def tracer(frame, event, arg):\r
    if frame.f_code.co_filename != FILENAME:\r
        return None\r
    if event == "call":\r
        return tracer\r
    if event == "line":\r
        if len(STEPS) >= MAX_STEPS:\r
            TRUNCATED[0] = True\r
            raise RuntimeError("__CODEREEL_STEP_LIMIT__")\r
        if STEP_BYTES[0] > SIZE_BUDGET:\r
            TRUNCATED[0] = True\r
            raise RuntimeError("__CODEREEL_SIZE_LIMIT__")\r
        if time.time() - STEP_START[0] > MAX_SECONDS:\r
            TRUNCATED[0] = True\r
            raise RuntimeError("__CODEREEL_TIME_LIMIT__")\r
        record(frame)\r
    return tracer\r
\r
\r
def make_node(value, cls, with_next):\r
    if cls is not None:\r
        try:\r
            node = cls(value)\r
            if with_next and not hasattr(node, "next"):\r
                node.next = None\r
            return node\r
        except Exception:\r
            pass\r
    if with_next:\r
        return types.SimpleNamespace(val=value, next=None)\r
    return types.SimpleNamespace(val=value, left=None, right=None)\r
\r
\r
def build_tree(arr, cls):\r
    if not isinstance(arr, (list, tuple)) or not arr or arr[0] is None:\r
        return None\r
    root = make_node(arr[0], cls, False)\r
    queue = [root]\r
    idx = 1\r
    guard = 0\r
    while queue and idx < len(arr) and guard < 500:\r
        cur = queue.pop(0)\r
        guard += 1\r
        if arr[idx] is not None:\r
            cur.left = make_node(arr[idx], cls, False)\r
            queue.append(cur.left)\r
        idx += 1\r
        if idx < len(arr) and arr[idx] is not None:\r
            cur.right = make_node(arr[idx], cls, False)\r
            queue.append(cur.right)\r
        idx += 1\r
    return root\r
\r
\r
def build_list(arr, cls):\r
    if not isinstance(arr, (list, tuple)) or not arr:\r
        return None\r
    head = make_node(arr[0], cls, True)\r
    cur = head\r
    for value in arr[1:]:\r
        cur.next = make_node(value, cls, True)\r
        cur = cur.next\r
    return head\r
\r
\r
def coerce(name, value, namespace):\r
    if not isinstance(value, (list, tuple)):\r
        return value\r
    lower = name.lower()\r
    tree_cls = namespace.get("TreeNode") or namespace.get("Node")\r
    list_cls = namespace.get("ListNode") or namespace.get("Node")\r
    if lower in ("root", "tree", "node", "bst"):\r
        return build_tree(value, tree_cls)\r
    if lower in ("head", "list", "linkedlist", "l1", "l2"):\r
        return build_list(value, list_cls)\r
    return value\r
\r
\r
def argname(param):\r
    return getattr(param, "arg", None) or getattr(param, "name", "arg")\r
\r
\r
def build_args(params, input_data, namespace):\r
    names = [argname(p) for p in params]\r
    if input_data is None:\r
        return [], names\r
    if isinstance(input_data, dict):\r
        if isinstance(input_data.get("args"), list):\r
            values = input_data["args"]\r
            return [\r
                coerce(names[i] if i < len(names) else "arg%d" % i, v, namespace)\r
                for i, v in enumerate(values)\r
            ], names\r
        args = []\r
        for idx, name in enumerate(names):\r
            if name in input_data:\r
                args.append(coerce(name, input_data[name], namespace))\r
            else:\r
                vals = list(input_data.values())\r
                args.append(coerce(name, vals[idx], namespace) if idx < len(vals) else None)\r
        return args, names\r
    if isinstance(input_data, (list, tuple)):\r
        if len(names) == 1:\r
            return [coerce(names[0], input_data, namespace)], names\r
        if len(input_data) == len(names):\r
            return [coerce(names[i], input_data[i], namespace) for i in range(len(names))], names\r
        if names:\r
            return [coerce(names[0], input_data, namespace)] + [None] * (len(names) - 1), names\r
        return [], names\r
    return ([coerce(names[0] if names else "arg", input_data, namespace)] if names else []), names\r
\r
\r
def find_target(module_tree, namespace):\r
    if any(isinstance(node, (ast.If, ast.For, ast.While, ast.Try, ast.With)) for node in module_tree.body):\r
        return None, "", []\r
    if any(isinstance(node, ast.Expr) and isinstance(node.value, ast.Call) for node in module_tree.body):\r
        return None, "", []\r
    funcs = [n for n in module_tree.body if isinstance(n, ast.FunctionDef)]\r
    classes = [n for n in module_tree.body if isinstance(n, ast.ClassDef)]\r
    if funcs and not classes:\r
        target = funcs[-1]\r
        fn = namespace.get(target.name)\r
        if fn is not None:\r
            return fn, target.name, target.args.args\r
    for klass in classes:\r
        methods = [n for n in klass.body if isinstance(n, ast.FunctionDef) and not n.name.startswith("__")]\r
        if not methods:\r
            continue\r
        klass_obj = namespace.get(klass.name)\r
        if klass_obj is None:\r
            continue\r
        method = methods[-1]\r
        try:\r
            instance = klass_obj()\r
        except Exception:\r
            continue\r
        fn = getattr(instance, method.name, None)\r
        if fn is not None:\r
            params = [a for a in method.args.args if a.arg != "self"]\r
            return fn, "%s.%s" % (klass.name, method.name), params\r
    return None, "", []\r
\r
\r
def ast_nodes(module_tree):\r
    category = {\r
        "For": "loop",\r
        "AsyncFor": "loop",\r
        "While": "loop",\r
        "If": "conditional",\r
        "Assign": "declaration",\r
        "AnnAssign": "declaration",\r
        "AugAssign": "declaration",\r
        "FunctionDef": "function",\r
        "AsyncFunctionDef": "function",\r
        "Lambda": "function",\r
        "Call": "call",\r
    }\r
    nodes = []\r
    for node in ast.walk(module_tree):\r
        name = type(node).__name__\r
        if name in ("Module", "Expr", "arguments", "arg", "Load", "Store", "Add", "Sub", "Mult", "Div"):\r
            continue\r
        line = getattr(node, "lineno", 0)\r
        if not line:\r
            continue\r
        try:\r
            details = ast.unparse(node)[:70]\r
        except Exception:\r
            details = name\r
        nodes.append({"type": name, "category": category.get(name, "other"), "line": line, "details": details})\r
        if len(nodes) >= 200:\r
            break\r
    return nodes\r
\r
\r
def main():\r
    payload = {\r
        "steps": [],\r
        "outputs": OUTPUTS,\r
        "error": None,\r
        "truncated": False,\r
        "entryPoint": "",\r
        "returnValue": None,\r
        "finalStructures": [],\r
        "astNodes": [],\r
        "elapsedMs": 0,\r
    }\r
    try:\r
        module_tree = ast.parse(USER_CODE, filename=FILENAME)\r
        payload["astNodes"] = ast_nodes(module_tree)\r
    except SyntaxError as exc:\r
        payload["error"] = "SyntaxError: %s (line %s)" % (exc.msg, exc.lineno)\r
        payload["steps"] = [\r
            {\r
                "line": exc.lineno or 1,\r
                "variables": [],\r
                "callStack": [],\r
                "explanation": payload["error"],\r
                "isError": True,\r
                "errorMessage": payload["error"],\r
                "outputCount": 0,\r
            }\r
        ]\r
        return payload\r
\r
    namespace = {"__name__": "__main__", "__builtins__": __builtins__}\r
    try:\r
        exec("from typing import *\\nfrom collections import *\\n", namespace)\r
        INJECTED.update(namespace.keys())\r
    except Exception:\r
        pass\r
\r
    STEP_START[0] = time.time()\r
    real_stdout = sys.stdout\r
    capture = Capture()\r
    sys.stdout = capture\r
    target = None\r
    target_name = ""\r
    target_args = []\r
    return_value = None\r
    try:\r
        sys.settrace(tracer)\r
        try:\r
            body = list(module_tree.body)\r
            trailing = None\r
            if body and isinstance(body[-1], ast.Expr) and not isinstance(\r
                body[-1].value, (ast.Constant, ast.JoinedStr)\r
            ):\r
                trailing = body.pop()\r
            exec_tree = ast.Module(body=body, type_ignores=[])\r
            ast.fix_missing_locations(exec_tree)\r
            exec(compile(exec_tree, FILENAME, "exec"), namespace)\r
            if trailing is not None:\r
                expr = ast.Expression(body=trailing.value)\r
                ast.fix_missing_locations(expr)\r
                try:\r
                    payload["entryPoint"] = ast.unparse(trailing.value)[:80]\r
                except Exception:\r
                    pass\r
                return_value = eval(compile(expr, FILENAME, "eval"), namespace)\r
            else:\r
                target, target_name, target_args = find_target(module_tree, namespace)\r
                if target is not None:\r
                    args, _names = build_args(target_args, INPUT_DATA, namespace)\r
                    payload["entryPoint"] = "%s(%s)" % (target_name, ", ".join(brief(a, 30) for a in args))\r
                    return_value = target(*args)\r
        finally:\r
            sys.settrace(None)\r
    except SyntaxError as exc:\r
        payload["error"] = "SyntaxError: %s (line %s)" % (exc.msg, exc.lineno)\r
    except RuntimeError as exc:\r
        message = str(exc)\r
        if message == "__CODEREEL_STEP_LIMIT__":\r
            payload["error"] = "Execution stopped after %d steps (possible infinite loop)." % MAX_STEPS\r
            payload["truncated"] = True\r
        elif message == "__CODEREEL_TIME_LIMIT__":\r
            payload["error"] = "Execution stopped after %.1fs (possible infinite loop)." % MAX_SECONDS\r
            payload["truncated"] = True\r
        elif message == "__CODEREEL_SIZE_LIMIT__":\r
            payload["error"] = "Trace stopped after %d steps to stay within the sandbox output limit." % len(STEPS)\r
            payload["truncated"] = True\r
        else:\r
            payload["error"] = "RuntimeError: %s" % message\r
    except RecursionError:\r
        payload["error"] = "RecursionError: maximum recursion depth exceeded."\r
    except Exception as exc:\r
        line = None\r
        tb = exc.__traceback__\r
        while tb is not None:\r
            if tb.tb_frame.f_code.co_filename == FILENAME:\r
                line = tb.tb_lineno\r
            tb = tb.tb_next\r
        payload["error"] = "%s: %s" % (type(exc).__name__, exc)\r
        payload["errorLine"] = line\r
    finally:\r
        sys.stdout = real_stdout\r
        capture.flush()\r
\r
    payload["steps"] = STEPS\r
    payload["truncated"] = payload["truncated"] or TRUNCATED[0]\r
    payload["elapsedMs"] = round((time.time() - STEP_START[0]) * 1000, 2)\r
    if payload["error"] and STEPS:\r
        message = payload["error"]\r
        last = STEPS[-1]\r
        payload["steps"].append(\r
            {\r
                "line": payload.get("errorLine") or last["line"],\r
                "variables": last["variables"],\r
                "callStack": last["callStack"],\r
                "explanation": "Runtime error: " + message,\r
                "isError": True,\r
                "errorMessage": message,\r
                "outputCount": len(OUTPUTS),\r
            }\r
        )\r
    elif not payload["error"]:\r
        if return_value is not None:\r
            payload["returnValue"] = {\r
                "name": "return",\r
                "value": json_safe(return_value),\r
                "display": brief(return_value, 120),\r
                "type": py_type(return_value),\r
            }\r
        value_structures = detect_structures([("return", return_value)]) if return_value is not None else []\r
        namespace_structures = detect_structures(list(namespace.items()))\r
        merged = []\r
        seen = set()\r
        for view in value_structures + namespace_structures:\r
            key = (view["kind"], view["name"])\r
            if key in seen:\r
                continue\r
            seen.add(key)\r
            merged.append(view)\r
        payload["finalStructures"] = merged[:8]\r
        if STEPS:\r
            last = STEPS[-1]\r
            STEPS.append(\r
                {\r
                    "line": last["line"],\r
                    "source": last.get("source", ""),\r
                    "variables": last["variables"],\r
                    "callStack": [],\r
                    "explanation": "Program finished - returned %s" % brief(return_value, 80)\r
                    if return_value is not None\r
                    else "Program finished",\r
                    "outputCount": len(OUTPUTS),\r
                    "returnValue": payload["returnValue"],\r
                    "dataStructures": payload["finalStructures"],\r
                }\r
            )\r
        elif return_value is not None:\r
            STEPS.append(\r
                {\r
                    "line": 1,\r
                    "variables": [],\r
                    "callStack": [],\r
                    "explanation": "Program finished - returned %s" % brief(return_value, 80),\r
                    "outputCount": len(OUTPUTS),\r
                    "returnValue": payload["returnValue"],\r
                    "dataStructures": payload["finalStructures"],\r
                }\r
            )\r
    payload["outputs"] = OUTPUTS\r
    return payload\r
\r
\r
payload = main()\r
encoded = json.dumps(payload, ensure_ascii=False, default=str)\r
sys.stdout.write("\\n" + MARK + encoded + END + "\\n")\r
`,n=`__CODEREEL_TRACE__`,r=`__CODEREEL_END__`;function i(e){let t=new TextEncoder().encode(e),n=``;for(let e of t)n+=String.fromCharCode(e);return btoa(n)}function a(e,n){let r=i(e),a=n===void 0?`None`:`json.loads(base64.b64decode("${i(JSON.stringify(n))}").decode("utf-8"))`;return t.replace(`__AL_USER_CODE_B64__`,r).replace(`__AL_INPUT_DATA__`,a)}async function o(t,i){let o=a(t,i),s=await e(`python`,o,``,{timeoutMs:4e4,retries:3});if(s.rateLimited||s.timedOut||s.error)return{error:s.error||`Python sandbox request failed.`,fatal:!0,transport:!0};if(s.compilerError.trim())return{error:`Python tracer failed to compile:\n${s.compilerError.trim()}`,fatal:!0};let c=s.stdout.lastIndexOf(n),l=c>=0?s.stdout.indexOf(r,c+18):-1;if(c<0||l<0){let e=s.stderr.trim();return{error:e?`Python tracer returned no trace:\n${e.slice(0,500)}`:`Python tracer returned no trace data.`,fatal:!0}}try{let e=JSON.parse(s.stdout.slice(c+18,l));return{payload:{steps:Array.isArray(e.steps)?e.steps:[],outputs:Array.isArray(e.outputs)?e.outputs:[],error:e.error??null,errorLine:e.errorLine,truncated:!!e.truncated,entryPoint:e.entryPoint||``,returnValue:e.returnValue??null,finalStructures:Array.isArray(e.finalStructures)?e.finalStructures:[],astNodes:Array.isArray(e.astNodes)?e.astNodes:[],elapsedMs:Number(e.elapsedMs)||0}}}catch(e){return{error:`Could not parse the Python trace: ${e?.message||e}`,fatal:!0}}}export{o as tracePython};