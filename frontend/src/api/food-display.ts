import type { Food, Schema } from "./models";
export const stagePalette = {broth:"#F3C46E",mango:"#FFCB45",bamboo:"#D8B27A",chili:"#D9632B",tomato:"#C9442B",redoil:"#A8321C",soy:"#8F5B24",porcelain:"#9DB8D9",matcha:"#9DBF7A"} as const;
export type Stage = keyof typeof stagePalette;
export function stageCode(hex:string):Stage {return (Object.keys(stagePalette) as Stage[]).find(k=>stagePalette[k]===hex)??"broth";}
export const mealOptions=[{id:"breakfast",name:"早饭"},{id:"lunch",name:"午饭"},{id:"dinner",name:"晚饭"},{id:"night",name:"夜宵"}] as const;
export function mealCode(name:string){return mealOptions.find(m=>m.name===name||m.id===name)?.id??"dinner";}
export function guestDeviceId(){try{let id=localStorage.getItem("eatwhat-recommend-device");if(!id||!/^[A-Za-z0-9_-]{8,64}$/.test(id)){id=crypto.randomUUID();localStorage.setItem("eatwhat-recommend-device",id);}return id;}catch{return undefined;}}
export function publishDisplay(stage:string,candidates?:string[],meals?:string[]):Pick<Schema["CreateFoodDTORequest"],"stageColor"|"stageAlternates"|"mealTimes">{
 const alternatives=[...new Set([...(candidates??[]).map(stageCode),...Object.keys(stagePalette) as Stage[]])].filter(k=>k!==stageCode(stage)).slice(0,2);
 return {stageColor:stageCode(stage),stageAlternates:alternatives,mealTimes:(meals?.length?meals:["dinner"]) as NonNullable<Food["mealTimes"]>};
}
