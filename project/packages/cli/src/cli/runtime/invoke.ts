import {invokeCompiledFunction as invoke,type InvokeCompiledFunctionOptions} from 'halfcode-lite-browser-capsule';
import {productRoots} from './registry';
export type {InvokeCompiledFunctionOptions,InvokeCompiledFunctionResult} from 'halfcode-lite-browser-capsule';
export function invokeCompiledFunction(options:InvokeCompiledFunctionOptions) {return invoke({...options,...productRoots(options)});}
