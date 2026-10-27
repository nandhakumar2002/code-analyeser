import * as parser from '@babel/parser';
const ast = parser.parse('const x = [1,2,3];', { sourceType: 'module' });
console.log(ast.program.body[0].type);
