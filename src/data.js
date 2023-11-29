import * as util from "./util.js"
import { abort } from 'process'
import { readFileSync,readdirSync } from 'fs'
export function handler(token, ctx, context) {
    var handlers = {
        data: {},
        "&&": "and",
        "||": "or",
        "!!": "not(",
        ";": ":",
        "===": "=",
        "==": "=",
        "true": "1",
        "false": "0",
        "::": ":",
        "const": (ctx,  context) => {
            var headers=context.headers=context.headers||{}
            if(headers=={}){
            readdirSync('./src/headers/').forEach((file)=>{
                headers=Object.assign(headers, JSON.parse(fs.readFileSync('./src/headers/'+file)));
            })
            }
            context.data = context.data || {}
            context.data.var = context.data.var || {}
            context.data.functions = context.data.functions || headers
            context.data.functionCall = context.data.functionCall || {}
            context.data.types=context.data.types||['number','string','list','boolexpr','methodCall','value']
            context.data.var.strLists = context.data.var.strLists || ["Str0", "Str1", "Str2", "Str3", "Str4", "Str5", "Str6", "Str7", "Str8", "Str9"]
            context.data.currentScope = context.data.currentScope || "global"
        },
        "var": function (ctx,  context, scope) {
            //util.log(context)
            scope = scope || context.data.currentScope || "global"
            var children = []
            
            var varType =context.visit(ctx.expression())
            //console.log(varType)
            
            if(!varType.type){
                varType=varType[0]
                if(!(varType==undefined)){
                    varType = varType.type
                }
            }else if(typeof varType.type=="string"){
                varType=varType.type
            }
            //console.log(varType)
            if(varType=="funcCall"){
                var varType =context.visit(ctx.expression())[0].retType
            }
            if(varType=="array"){
                var varType =context.visit(ctx.expression())[0].listType
            }
            if(ctx.hasOwnProperty('type')&&(typeof ctx.type=="function")&&(!(ctx.type()==null)))varType=ctx.type().getText()
            if(varType==undefined){varType="undef";util.warn(`${ctx.identifier().getText()} is undefined! A type could not be infered! This may be bad!`,ctx)}
            context.data.var[ctx.identifier().getText()]={varType}
            return { name: ctx.identifier().getText(), varType, children:[context.visit(ctx.expression())], type: "varDec" }
        },
        "while": function (ctx,  context) {
            var body = context.visit(ctx.statement())
            return { type: "while", condition: context.visit(ctx.boolexpr()), children: body }
        },
        "if": (ctx,  context) => {
            var body = context.visit(ctx.statement())
            return { type: "if", condition: context.visit(ctx.boolexpr()), children: body }
            //return `If ${ctx.boolexpr().getText()}:${body.substring(1, body.length - 1)}:End:`
        },
        "ifElse": (ctx,  context) => {
            var ifBody = context.visit(ctx.statement()[0])
            var elseBody = context.visit(ctx.statement()[1])
            return { type: "if", condition: context.visit(ctx.boolexpr()), children: [ifBody,elseBody] }
            //return `If ${ctx.boolexpr().getText()}:${ifBody.substring(1, ifBody.length - 1)}:Else:${elseBody.substring(1, elseBody.length - 1)}:End:`
        },
        "asm": (ctx,  context) => {
            return {type:"asm",children:[],contents:ctx.any().getText()}
        },
        "funcParams": (ctx,  context) => {

            let code = [];

            for (let i = 0; i < ctx.getChildCount(); i++) {

                if (!(context.visit(ctx.getChild(i)) == "")) code.push(context.visit(ctx.getChild(i)));
            }

            return code;
        },
        "function": (ctx,  context) => {

            //util.log('ctx:', ctx)

            var paramsList = ctx.func_params().getText().split(')')[0].split(',')
            var params = []
            paramsList.forEach((elm) => { params.push({ name: elm.split(':')[0], type: elm.split(':')[1] }) })
            context.data.functions[ctx.identifier().getText()] = { type: "function", name: ctx.identifier().getText(), params, retType: ctx.type().getText(), children: context.visit(ctx.statement()) }
            return context.data.functions[ctx.identifier().getText()]

            //util.log(ctx.number())
            //return `:Label ${context.data.functions[name].label}:${context.visit(ctx.statement())}:______:`
        },
        "varAcess": (ctx,  context) => {
            if (context.visitChildren(ctx)[0].type=="number") {
                return {type:"number",value:ctx.getText(),children:[]}
            } else {
                try {
                    return { type: "var", children: [], name: ctx.identifier().getText(), type: context.data.var[ctx.identifier().getText()].varType }
                } catch {

                    util.error(`${ctx.identifier().getText()} is undefined`, 'Alloc', ctx)
                }

            }
        },
        "funcCall": (ctx,  context) => {

            var method = []
            //util.log(ctx.identifier().getText())
            ctx.identifier().getText().split('.').forEach((elm) => {
                method.push(elm)
            })
            var baseClass = []
            if (method.length > 1) {
                baseClass = method.slice(0, -1)
            }
            util.log("method:", ctx.identifier().getText())
            try {
                return { type: "funcCall", children: [], class: baseClass, name: method[method.length - 1], params: context.visit(ctx.methodparams()), retType: context.data.functions[method.join('.')].retType }
            } catch (err) {
                util.termLog(`ERROR: ${err}`, ctx.identifier().getText(), JSON.stringify(method), JSON.stringify(context.visit(ctx.methodparams())))
                //abort()
            }
        },
        'list':(ctx,context)=>{
                var list = ctx.getText().replace('[', '')
                list = util.split(list.slice(list.length - 1, 1), ',', util.genStrMap(list.slice(list.length - 1, 1)))
                return { type:"array", value: list, children:context.visitChildren(),listType:context.visitChildren()[0].type}
        },
        'string':(ctx)=>{
            return {type:"string",value:ctx.getText(),children:[]}
        },
        'number':(ctx)=>{
            return {type:"number",value:ctx.getText(),children:[]}
        },
        'bool':(ctx,context)=>{
            var src=ctx.getText()
            var comparisons=[]
            var types=["||","<",">","==","!=","<=",">=","&&","!","true","false"]
            types.forEach((elm)=>{
                if((src.split(elm).length)>1){
                    comparisons.push(elm)
                }
            })
            //console.log({type:"bool",condition:ctx.getText(),children:[],comparisons})
            return {type:"bool",condition:ctx.getText(),children:[],comparisons}
        },
        'math':(ctx,context)=>{
            var ops=["+","/","-","*"]
            var src=ctx.getText()
            var operations=[]
            ops.forEach((elm)=>{
                if(src.split(elm).length>1){
                    operations.push(elm)
                }
            })
            return {type:"math",children:context.visit(ctx),operations}
        },
        "expr":(ctx,context)=>{
            var res= context.visitChildren(ctx)
            if((res==[undefined])||(res==[])||(res==[[]])){
                res=[{children:[]}]
            }
            //antlr hacks
            res.forEach((elm,i)=>{
                if(typeof elm=="string"){
                if(elm.startsWith('"')){
                    res[i]=handler('string',ctx,context)
                }}
            })
            
            return res
        },
        "return":(ctx,context)=>{
            return {type:"return",value:context.visit(ctx.expression())}
        },
        "import":(ctx,context)=>{
            return {type:"import",name:ctx.identifier().getText()}
        }
    }
    
    //util.log(context)
    if (!token) {
        return handlers
    }
    //var children = context.visitChildren(ctx)


    if (handlers.hasOwnProperty(token)) {

        if (typeof handlers[token] == "function") {
            //util.log(Object.keys(ctx),":ctx")
            handlers.const(ctx,  context)
            util.log(true, token + ':', ctx.getText(), handlers[token](ctx, context, ...Array.from(arguments).slice(2)))
            return handlers[token](ctx, context, ...Array.from(arguments).slice(2))
        } else {
            return handlers[token]
        }
    }
    return {children:context.visitChildren(ctx)}
}
