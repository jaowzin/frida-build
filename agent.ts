// @ts-nocheck
import "frida-il2cpp-bridge";

const MENU_LIB_NAME = "libmenu.so";
const TARGET_ASSEMBLY = "Assembly-CSharp";

console.log("[+] Loader Frida para menu nativo iniciado");
console.log("[+] Menu lib: " + MENU_LIB_NAME);

let nativeRender = null;
let nativeSetText = null;

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  if (i <= 0) return "";
  return path.substring(0, i);
}

function findModuleByNameSafe(name: string) {
  try {
    const mods = Process.enumerateModules();

    for (const m of mods) {
      if (m.name === name) {
        return m;
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

function listarModsImportantes() {
  console.log("[+] Listando libs importantes carregadas:");

  for (const m of Process.enumerateModules()) {
    const name = m.name.toLowerCase();

    if (
      name.includes("gadget") ||
      name.includes("il2cpp") ||
      name.includes("unity") ||
      name.includes("main") ||
      name.includes("menu") ||
      name.includes("egl")
    ) {
      console.log("[MOD] " + m.name + " -> " + m.path);
    }
  }
}

function findLibDir(): string | null {
  const mods = Process.enumerateModules();

  const refs = [
    "libil2cpp.so",
    "libunity.so",
    "libmain.so",
    "libgadget.so",
    "gadget.so",
    "libfrida-gadget.so"
  ];

  for (const ref of refs) {
    for (const m of mods) {
      if (m.name === ref) {
        const dir = dirname(m.path);

        console.log("[+] Referencia encontrada: " + ref);
        console.log("[+] Caminho: " + m.path);
        console.log("[+] Pasta nativa: " + dir);

        return dir;
      }
    }
  }

  console.log("[-] Nenhuma lib de referencia encontrada");
  return null;
}

function tryLoad(pathOrName: string): boolean {
  try {
    console.log("[*] Tentando carregar:");
    console.log("    " + pathOrName);

    Module.load(pathOrName);

    console.log("[+] Carregou:");
    console.log("    " + pathOrName);

    return true;
  } catch (e) {
    console.log("[-] Falhou ao carregar:");
    console.log("    " + pathOrName);
    console.log(String(e));
    return false;
  }
}

function loadMenuLib(): boolean {
  const already = findModuleByNameSafe(MENU_LIB_NAME);

  if (already != null) {
    console.log("[+] Lib do menu ja estava carregada");
    console.log("[+] Base: " + already.base);
    console.log("[+] Path: " + already.path);
    return true;
  }

  if (tryLoad(MENU_LIB_NAME)) {
    return true;
  }

  const dir = findLibDir();

  if (dir != null) {
    const fullPath = dir + "/" + MENU_LIB_NAME;

    if (tryLoad(fullPath)) {
      return true;
    }
  }

  console.log("[-] Nao consegui carregar " + MENU_LIB_NAME);
  return false;
}

function findExport(libName: string, exportName: string) {
  try {
    const mods = Process.enumerateModules();

    for (const m of mods) {
      if (m.name === libName) {
        console.log("[+] Modulo encontrado:");
        console.log("    " + m.name + " -> " + m.path);

        const exportsList = m.enumerateExports();

        for (const ex of exportsList) {
          if (ex.name === exportName) {
            console.log("[+] Export encontrado: " + exportName + " -> " + ex.address);
            return ex.address;
          }
        }

        console.log("[-] Export nao encontrado em " + libName + ": " + exportName);
        return null;
      }
    }

    console.log("[-] Modulo nao encontrado: " + libName);
    return null;
  } catch (e) {
    console.log("[-] Erro procurando export " + exportName + ":");
    console.log(String(e));
    return null;
  }
}

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
    console.log("[-] Erro chamando native_init:");
    console.log(String(e));
    return false;
  }

  console.log("[+] Exports carregados com sucesso");
  return true;
}

function hookEglSwapBuffers(): boolean {
  let eglSwap = findExport("libEGL.so", "eglSwapBuffers");

  if (eglSwap == null) {
    console.log("[*] Procurando eglSwapBuffers em outros modulos EGL...");

    for (const m of Process.enumerateModules()) {
      if (m.name.toLowerCase().includes("egl")) {
        console.log("[*] Testando modulo: " + m.name);

        eglSwap = findExport(m.name, "eglSwapBuffers");

        if (eglSwap != null) {
          console.log("[+] eglSwapBuffers encontrado em: " + m.name);
          break;
        }
      }
    }
  }

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
        // evita flood
      }
    }
  });

  console.log("[+] Hook eglSwapBuffers instalado");
  return true;
}

function setMenuText(text: string) {
  if (nativeSetText == null) {
    console.log("[-] native_set_text nao carregado");
    return;
  }

  const p = Memory.allocUtf8String(text);
  nativeSetText(p);
}

function getIl2CppInfo(): string {
  let out = "";

  Il2Cpp.perform(() => {
    out += "Frida Native Menu\n";
    out += "====================\n\n";
    out += "Menu carregado via Frida script\n";
    out += "Menu lib: libmenu.so\n";
    out += "Sem Java.perform()\n";
    out += "Sem Activity\n";
    out += "Sem DEX\n\n";

    out += "Unity: " + Il2Cpp.unityVersion + "\n";
    out += "Assemblies: " + Il2Cpp.domain.assemblies.length + "\n\n";

    const asm = Il2Cpp.domain.assembly(TARGET_ASSEMBLY);

    if (asm == null) {
      out += "Assembly-CSharp nao encontrada\n\n";
      out += "Assemblies disponiveis:\n";

      for (const a of Il2Cpp.domain.assemblies) {
        out += "- " + a.image.name + "\n";
      }

      return;
    }

    const classes = asm.image.classes;

    out += "Assembly: " + asm.image.name + "\n";
    out += "Total classes: " + classes.length + "\n\n";
    out += "Primeiras classes:\n";

    for (let i = 0; i < classes.length && i < 100; i++) {
      out += i + ". " + classes[i].name + "\n";
    }

    if (classes.length > 100) {
      out += "\n... mais " + (classes.length - 100) + " classes";
    }
  });

  return out;
}

setTimeout(() => {
  console.log("[+] Iniciando script...");
  listarModsImportantes();

  const loaded = loadMenuLib();

  if (!loaded) {
    console.log("[-] Falhou ao carregar libmenu.so");
    console.log("[-] Confira se esta dentro do APK:");
    console.log("    lib/arm64-v8a/libmenu.so");
    console.log("");
    console.log("[-] No Android instalado deve aparecer como:");
    console.log("    /data/app/.../lib/arm64/libmenu.so");
    return;
  }

  const exportsOk = resolveExports();

  if (!exportsOk) {
    console.log("[-] A lib carregou, mas nao tem os exports:");
    console.log("    native_init");
    console.log("    native_render");
    console.log("    native_set_text");
    return;
  }

  const hooked = hookEglSwapBuffers();

  if (!hooked) {
    console.log("[-] Falhou hook eglSwapBuffers");
    return;
  }

  setTimeout(() => {
    try {
      const info = getIl2CppInfo();
      setMenuText(info);
      console.log("[+] Texto IL2CPP enviado para menu");
    } catch (e) {
      console.log("[-] Erro pegando info IL2CPP:");
      console.log(String(e));
    }
  }, 3000);

  console.log("[+] Script finalizado, menu deve renderizar nos frames");

}, 5000);