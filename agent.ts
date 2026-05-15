// @ts-nocheck
import "frida-il2cpp-bridge";

const MENU_LIB_NAME = "libmenu.so";
const TARGET_ASSEMBLY = "Assembly-CSharp";

console.log("[+] Loader Frida menu iniciado");
console.log("[+] Menu lib: " + MENU_LIB_NAME);

let nativeRender = null;
let nativeSetText = null;
let nativeHandleInput = null;

function dirname(path) {
  const i = path.lastIndexOf("/");
  if (i <= 0) return "";
  return path.substring(0, i);
}

function findModule(name) {
  const mods = Process.enumerateModules();

  for (const m of mods) {
    if (m.name === name) {
      return m;
    }
  }

  return null;
}

function findLibDir() {
  const refs = [
    "libil2cpp.so",
    "libunity.so",
    "libmain.so",
    "libgadget.so",
    "gadget.so",
    "libfrida-gadget.so"
  ];

  const mods = Process.enumerateModules();

  for (const ref of refs) {
    for (const m of mods) {
      if (m.name === ref) {
        const dir = dirname(m.path);
        console.log("[+] Referencia: " + ref);
        console.log("[+] Dir: " + dir);
        return dir;
      }
    }
  }

  return null;
}

function tryLoad(path) {
  try {
    console.log("[*] Tentando carregar: " + path);
    Module.load(path);
    console.log("[+] Carregou: " + path);
    return true;
  } catch (e) {
    console.log("[-] Falhou: " + path);
    console.log(String(e));
    return false;
  }
}

function loadMenuLib() {
  const already = findModule(MENU_LIB_NAME);

  if (already) {
    console.log("[+] Lib ja carregada: " + already.path);
    return true;
  }

  if (tryLoad(MENU_LIB_NAME)) {
    return true;
  }

  const dir = findLibDir();

  if (dir) {
    return tryLoad(dir + "/" + MENU_LIB_NAME);
  }

  return false;
}

function findExport(libName, exportName) {
  const mod = findModule(libName);

  if (!mod) {
    return null;
  }

  const list = mod.enumerateExports();

  for (const ex of list) {
    if (ex.name === exportName) {
      console.log("[+] Export: " + exportName + " -> " + ex.address);
      return ex.address;
    }
  }

  return null;
}

function resolveExports() {
  const initPtr = findExport(MENU_LIB_NAME, "native_init");
  const renderPtr = findExport(MENU_LIB_NAME, "native_render");
  const setTextPtr = findExport(MENU_LIB_NAME, "native_set_text");
  const inputPtr = findExport(MENU_LIB_NAME, "native_handle_input");

  if (!initPtr || !renderPtr || !setTextPtr || !inputPtr) {
    console.log("[-] Exports faltando na libmenu.so");
    console.log("[-] Precisa ter:");
    console.log("    native_init");
    console.log("    native_render");
    console.log("    native_set_text");
    console.log("    native_handle_input");
    return false;
  }

  const nativeInit = new NativeFunction(initPtr, "void", []);
  nativeRender = new NativeFunction(renderPtr, "void", []);
  nativeSetText = new NativeFunction(setTextPtr, "void", ["pointer"]);
  nativeHandleInput = new NativeFunction(inputPtr, "void", ["pointer"]);

  try {
    nativeInit();
    console.log("[+] native_init OK");
  } catch (e) {
    console.log("[-] native_init falhou:");
    console.log(String(e));
    return false;
  }

  return true;
}

function hookEglSwapBuffers() {
  const eglSwap = findExport("libEGL.so", "eglSwapBuffers");

  if (!eglSwap) {
    console.log("[-] eglSwapBuffers nao encontrado");
    return false;
  }

  Interceptor.attach(eglSwap, {
    onEnter(args) {
      try {
        if (nativeRender) {
          nativeRender();
        }
      } catch (e) {}
    }
  });

  console.log("[+] Hook eglSwapBuffers instalado");
  return true;
}

function hookInputQueue() {
  try {
    if (!findModule("libandroid.so")) {
      tryLoad("libandroid.so");
    }

    const getEvent = findExport("libandroid.so", "AInputQueue_getEvent");

    if (!getEvent) {
      console.log("[-] AInputQueue_getEvent nao encontrado");
      console.log("[-] Menu vai aparecer, mas sem toque");
      return false;
    }

    Interceptor.attach(getEvent, {
      onEnter(args) {
        this.outEvent = args[1];
      },
      onLeave(retval) {
        try {
          if (!nativeHandleInput) return;

          const r = retval.toInt32();

          if (r >= 0 && this.outEvent) {
            const eventPtr = this.outEvent.readPointer();

            if (!eventPtr.isNull()) {
              nativeHandleInput(eventPtr);
            }
          }
        } catch (e) {}
      }
    });

    console.log("[+] Hook input instalado");
    console.log("[+] Agora o ImGui deve aceitar toque");
    return true;

  } catch (e) {
    console.log("[-] Erro hook input:");
    console.log(String(e));
    return false;
  }
}

function setMenuText(text) {
  if (!nativeSetText) return;

  const p = Memory.allocUtf8String(text);
  nativeSetText(p);
}

function getIl2CppInfo() {
  let out = "";

  Il2Cpp.perform(function () {
    out += "Frida Native Menu\n";
    out += "====================\n\n";
    out += "Menu lib: libmenu.so\n";
    out += "Sem Java.perform()\n";
    out += "Sem Activity\n";
    out += "Sem DEX\n\n";

    out += "Unity: " + Il2Cpp.unityVersion + "\n";
    out += "Assemblies: " + Il2Cpp.domain.assemblies.length + "\n\n";

    const asm = Il2Cpp.domain.assembly(TARGET_ASSEMBLY);

    if (!asm) {
      out += "Assembly-CSharp nao encontrada\n";
      return;
    }

    const classes = asm.image.classes;

    out += "Assembly: " + asm.image.name + "\n";
    out += "Total classes: " + classes.length + "\n\n";

    for (let i = 0; i < classes.length && i < 60; i++) {
      out += i + ". " + classes[i].name + "\n";
    }
  });

  return out;
}

function main() {
  console.log("[+] Iniciando script...");

  if (!loadMenuLib()) {
    console.log("[-] Falhou ao carregar libmenu.so");
    console.log("[-] Coloque no APK:");
    console.log("    lib/arm64-v8a/libmenu.so");
    return;
  }

  if (!resolveExports()) {
    console.log("[-] Falhou exports");
    return;
  }

  if (!hookEglSwapBuffers()) {
    console.log("[-] Falhou render hook");
    return;
  }

  hookInputQueue();

  setTimeout(function () {
    try {
      const info = getIl2CppInfo();
      setMenuText(info);
      console.log("[+] Texto enviado para menu");
    } catch (e) {
      console.log("[-] Erro IL2CPP:");
      console.log(String(e));
    }
  }, 3000);

  console.log("[+] Script pronto");
}

setTimeout(main, 5000);