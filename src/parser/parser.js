import { readFileSync, writeFileSync,readdirSync } from 'fs'
import { parseSync } from '@swc/core';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import * as importSync from 'import-sync'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

var data={}
function parse(file) {
    file=readFileSync(file).toString()
    var ast =[]
    var imports=extractImports(file)
    file=imports[1]
    imports[0].forEach(elm=>ast.push(elm))
    //console.log('file:',file+'\n',ast)
    const swcAst = parseSync(file, { syntax: "typescript" });
    parseNode(swcAst).forEach(elm=>ast.push(elm))
    return ast
}
function extractImports(file){
    var lines=0
    var imports=file.split(';').flatMap((elm)=>{
        elm= elm.trim()
        if(elm.indexOf('import')==0){
            lines++
            elm=elm.replace('import','').trim()
            //console.log(elm)
            return [{node:'import',name:elm}]
        }else{
            return []
        }
    })
    file=file.split(';').filter((elm,i)=>i+1>lines).join(';')
    return [imports,file]
}
function parseNode(node) {
    var body = getBody(node)
    var ast=[]
    if (!(JSON.stringify(body) == '{}')) {
        //console.log(body)
        if (body instanceof Array) { 
            body.forEach(elm=>{
                var node=astNodeHandler(elm,parseNode)
                ast.push(node.elm)
                data=node.data

            })
        } else {
            var node=astNodeHandler(body,parseNode)
                ast.push(node.elm)
                data=node.data
        }
    }
    return ast
}
function getBody(node) {
    var bodies=['body','stmts','expression','callee']
    var body ={}
    bodies.forEach((elm)=>{
        if(node.hasOwnProperty(elm)){
            body=node[elm]
        }
    })
    return body
    
}
function astNodeHandler(elm,parser){
    console.log(elm)
}

writeFileSync('./src/parser/ast.json', JSON.stringify(parse('./tests/snake.gs')))
console.log()