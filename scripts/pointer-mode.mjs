export function pointerMode(options, width) {
  if (options.touch) return "touch";
  if (options.mouse) return "mouse";
  return width < 600 ? "touch" : "mouse";
}

export async function applyPointerMode(send, mode) {
  const show = mode === "touch" ? ".iso-hint-touch" : ".iso-hint-pointer";
  const hide = mode === "touch" ? ".iso-hint-pointer" : ".iso-hint-touch";
  const css = `${show}{display:inline!important}${hide}{display:none!important}`;
  const source = `(()=>{const add=()=>{const style=document.createElement("style");style.setAttribute("data-pointer-mode","${mode}");style.textContent=${JSON.stringify(css)};(document.head||document.documentElement).appendChild(style)};if(document.documentElement)add();else document.addEventListener("readystatechange",add,{once:true})})();`;
  await send("Page.addScriptToEvaluateOnNewDocument", { source });
  if (mode === "touch") await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
}
