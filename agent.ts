// @ts-nocheck
import "frida-il2cpp-bridge";

const OUT_DIR = "/storage/emulated/0/Download";
const OUT_FILE = OUT_DIR + "/dump.cs";

console.log("[+] IL2CPP dump usando Il2Cpp.dump()");

setTimeout(function () {
  Il2Cpp.perform(function () {
    try {
      console.log("[+] IL2CPP pronto");
      console.log("[+] Unity: " + Il2Cpp.unityVersion);
      console.log("[+] Assemblies: " + Il2Cpp.domain.assemblies.length);

      console.log("[+] Gerando dump com funcao nativa do bridge...");

      // Função própria do frida-il2cpp-bridge
      Il2Cpp.dump(OUT_FILE);

      console.log("[+] Dump salvo em:");
      console.log("    " + OUT_FILE);
    } catch (e) {
      console.log("[-] Erro no Il2Cpp.dump():");
      console.log(String(e));
    }
  });
}, 5000);