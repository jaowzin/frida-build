// @ts-nocheck
import "frida-il2cpp-bridge";

const MENU_LIB = "/storage/emulated/0/Download/libfrida_menu.so";
const TARGET_ASSEMBLY = "Assembly-CSharp";

console.log("[+] Loader menu nativo iniciado");
console.log("[+] Caminho da lib: " + MENU_LIB);

let nativeRender = null;
let nativeSetText = null;

function loadNativeMenu() {
  try {
    console.log("[+] Carregando lib: " + MENU_LIB);

    Module.load(MENU_LIB);

    const initPtr = Module.findExportByName("libfrida_menu.so", "native_init");
    const renderPtr = Module.findExportByName("libfrida_menu.so", "native_render");
    const setTextPtr = Module.findExportByName("libfrida_menu.so", "native_set_text");

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

    nativeInit();

    console.log("[+] Lib nativa inicializada");
    return true;
  } catch (e) {
    console.log("[-] Erro carregando menu nativo: " + e);
    return false;
  }
}

function hookEglSwapBuffers() {
  const eglSwap = Module.findExportByName("libEGL.so", "eglSwapBuffers");

  if (eglSwap == null) {
    console.log("[-] eglSwapBuffers nao encontrado");
    return false;
  }

  Interceptor.attach(eglSwap, {
    onEnter(args) {
      try {
        if (nativeRender != null) {
          nativeRender();
        }
      } catch (e) {
        // evita flood de log
      }
    }
  });

  console.log("[+] Hook eglSwapBuffers instalado");
  return true;
}

function setMenuText(text: string) {
  if (nativeSetText == null) return;

  const ptr = Memory.allocUtf8String(text);
  nativeSetText(ptr);
}

function getIl2CppInfo(): string {
  let out = "";

  Il2Cpp.perform(() => {
    out += "Frida IL2CPP Menu\n";
    out += "====================\n\n";

    out += "Unity: " + Il2Cpp.unityVersion + "\n";
    out += "Assemblies: " + Il2Cpp.domain.assemblies.length + "\n\n";

    const asm = Il2Cpp.domain.assembly(TARGET_ASSEMBLY);

    if (asm == null) {
      out += "Assembly-CSharp nao encontrada\n\n";
      out += "Assemblies disponiveis:\n";

      for (const a of Il2Cpp.domain.assemblies) {
        out += "- " + a.image.name + "\n";
      }

      return out;
    }

    const classes = asm.image.classes;

    out += "Assembly: " + asm.image.name + "\n";
    out += "Total classes: " + classes.length + "\n\n";
    out += "Primeiras classes:\n";

    for (let i = 0; i < classes.length && i < 120; i++) {
      out += i + ". " + classes[i].name + "\n";
    }

    if (classes.length > 120) {
      out += "\n... mais " + (classes.length - 120) + " classes";
    }
  });

  return out;
}

setTimeout(() => {
  const loaded = loadNativeMenu();

  if (!loaded) {
    console.log("[-] Falhou ao carregar menu");
    console.log("[-] Verifique se a lib esta aqui:");
    console.log(MENU_LIB);
    return;
  }

  const hooked = hookEglSwapBuffers();

  if (!hooked) {
    console.log("[-] Falhou ao hookar eglSwapBuffers");
    return;
  }

  setTimeout(() => {
    try {
      const info = getIl2CppInfo();
      setMenuText(info);
      console.log("[+] Info IL2CPP enviada para menu");
    } catch (e) {
      console.log("[-] Erro pegando info IL2CPP: " + e);
    }
  }, 3000);

}, 5000);