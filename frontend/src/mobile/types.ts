import type {Component, ReactNode} from 'react';
export type DesignNode={tag:string;attrs:Record<string,string|boolean>;children:(DesignNode|string)[];id:number};
export type Values=Record<string,any>;
export type Controller=Component<any,any>&{state:Values;renderVals:()=>Values};
export type NodeView={node:DesignNode;props:Values;children:ReactNode[];text:string;scope:Values;screen:string};
export type Bridge={values:Values;node:(view:NodeView)=>ReactNode|undefined;before?:ReactNode;after?:ReactNode;busy?:boolean;reference?:boolean;hideContent?:boolean};
