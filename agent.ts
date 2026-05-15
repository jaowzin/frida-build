import "frida-il2cpp-bridge";

const TARGET_ASSEMBLY = "Assembly-CSharp";

Il2Cpp.perform(() => {
  console.log("[+] Il2Cpp carregado");
  console.log("[+] Unity: " + Il2Cpp.unityVersion);

  setTimeout(() => {
    const assembly = Il2Cpp.domain.assembly(TARGET_ASSEMBLY);

    if (assembly == null) {
      console.log("[-] Assembly nao encontrada: " + TARGET_ASSEMBLY);
      return;
    }

    Il2Cpp.trace(false)
      .assemblies(assembly)
      .filterMethods(method => !method.isExternal)
      .and()
      .attach();

    console.log("[+] Trace simples instalado em Assembly-CSharp");
  }, 30000);
});