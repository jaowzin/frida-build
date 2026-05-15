// @ts-nocheck
import "frida-il2cpp-bridge";

const MENU_LIB_NAME = "libmenu.so";
const TARGET_ASSEMBLY = "Assembly-CSharp";

console.log("[+] Loader Frida para menu nativo iniciado");
console.log("[+] Menu lib: " + MENU_LIB_NAME);

let nativeRender: any = null;
let nativeSetText: any = null;

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  if (i <= 0) return "";
  return path.substring(0, i);
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

function findModuleByNameSafe(name: string) {
  try {
    for (const m of Process.enumerateModules()) {
      if (m.name === name) {
        return m;
      }
    }
  } catch (e) {}

  return null;
}

function findLibDir(): string | null {
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
  const setTextPtr = find