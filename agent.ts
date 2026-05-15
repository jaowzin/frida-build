// @ts-nocheck
import "frida-il2cpp-bridge";

const MENU_LIB_NAME = "libfrida_menu.so";
const TARGET_ASSEMBLY = "Assembly-CSharp";

console.log("[+] Loader menu nativo iniciado");
console.log("[+] Tentando carregar lib interna: " + MENU_LIB_NAME);

let nativeRender = null;
let nativeSetText = null;

function loadNativeMenu() {
  try {
    Module.load(MENU_LIB_NAME);

    console.log("[+] Lib carregada: " + MENU_LIB_NAME);

    const initPtr = Module.findExportByName(MENU_LIB_NAME, "native_init");
    const renderPtr = Module.findExportByName(MENU_LIB_NAME, "native_render");
    const setTextPtr = Module.findExportByName(MENU_LIB_NAME, "native_set_text");

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

    console.log("[+] Menu nativo inicializado");
    return true;

  } catch (e) {
    console.log("[-] Erro carregando lib interna:");
    console.log(String(e));
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
        // evita flood no console
      }
    }
  });

  console.log("[+] Hook eglSwapBuffers instalado");
  return true;
}

function setMenuText(text) {
  if (nativeSetText == null) {
    console.log("[-] nativeSetText ainda nao inicializado");
    return;
  }

  const ptr = Memory.allocUtf8String(text);
  nativeSetText(ptr);
}

function getIl2CppInfo() {
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

    const image = asm.image;
    const classes = image.classes;

    out += "Assembly: " + image.name + "\n";
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
    console.log("[-] Falhou ao carregar libfrida_menu.so");
    console.log("[-] Confira se ela esta dentro do APK em:");
    console.log("    lib/arm64-v8a/libfrida_menu.so");
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
      console.log("[+] Info IL2CPP enviada para o menu");
    } catch (e) {
      console.log("[-] Erro pegando info IL2CPP:");
      console.log(String(e));
    }
  }, 3000);

}, 5000);