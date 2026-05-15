function resolveExports(): boolean {
  const initPtr = findExport(MENU_LIB_NAME, "native_init");
  const renderPtr = findExport(MENU_LIB_NAME, "native_render");
  const setTextPtr = findExport(MENU_LIB_NAME, "native_set_text");

  if (initPtr == null) {
    console.log("[-] Export native_init nao encontrado");
    return false;
  }

  if (renderPtr == null) {
    console.log("[-] Export native_render nao encontrado");
    return false;
  }

  if (setTextPtr == null) {
    console.log("[-] Export native_set_text nao encontrado");
    return false;
  }

  const nativeInit = new NativeFunction(initPtr, "void", []);
  nativeRender = new NativeFunction(renderPtr, "void", []);
  nativeSetText = new NativeFunction(setTextPtr, "void", ["pointer"]);

  try {
    nativeInit();
    console.log("[+] native_init chamado com sucesso");
  } catch (e) {
    console.log("[-] native_init falhou:");
    console.log(String(e));
    console.log("[-] Pare aqui e recompile a libmenu.so com o menu.cpp corrigido");
    return false;
  }

  console.log("[+] Exports carregados com sucesso");
  return true;
}