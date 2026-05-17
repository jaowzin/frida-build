// @ts-nocheck
import "frida-il2cpp-bridge";

const OUT_NAME = "dump.cs";

// Testa primeiro essa pasta.
// Se der permissão negada, use a pasta interna do app.
const OUT_DIR = "/sdcard/Download";

console.log("[+] IL2CPP dump usando Il2Cpp.dump(nome, pasta)");

setTimeout(function () {
  Il2Cpp.perform(function () {
    try {
      console.log("[+] IL2CPP pronto");
      console.log("[+] Unity: " + Il2Cpp.unityVersion);
      console.log("[+] Assemblies: " + Il2Cpp.domain.assemblies.length);

      console.log("[+] Salvando em:");
      console.log("    " + OUT_DIR + "/" + OUT_NAME);

      Il2Cpp.dump(OUT_NAME, OUT_DIR);

      console.log("[+] Dump salvo com sucesso:");
      console.log("    " + OUT_DIR + "/" + OUT_NAME);
    } catch (e) {
      console.log("[-] Erro no Il2Cpp.dump():");
      console.log(String(e));
    }
  });
}, 5000);