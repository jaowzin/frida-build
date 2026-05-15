import "frida-il2cpp-bridge";

const TARGET_ASSEMBLY = "Assembly-CSharp";

console.log("[+] Trace Assembly-CSharp iniciado");

Il2Cpp.perform(() => {
  const assembly = Il2Cpp.domain.assembly(TARGET_ASSEMBLY);

  if (assembly == null) {
    console.log("[-] Assembly-CSharp nao encontrada");

    console.log("[*] Assemblies disponiveis:");
    for (const asm of Il2Cpp.domain.assemblies) {
      console.log(" - " + asm.image.name);
    }

    return;
  }

  const image = assembly.image;

  console.log("[+] Assembly encontrada: " + image.name);
  console.log("[+] Classes: " + image.classes.length);

  let totalHooks = 0;

  for (const klass of image.classes) {
    for (const method of klass.methods) {
      try {
        if (method.virtualAddress.isNull()) {
          continue;
        }

        const fullName = `${klass.name}.${method.name}`;

        Interceptor.attach(method.virtualAddress, {
          onEnter(args) {
            console.log("[CALL] " + fullName);
          }
        });

        totalHooks++;
      } catch (e) {
        console.log("[-] Erro em " + klass.name + "." + method.name + ": " + e);
      }
    }
  }

  console.log("[+] Trace instalado");
  console.log("[+] Total de metodos hookados: " + totalHooks);
});