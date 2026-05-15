// @ts-nocheck
import "frida-il2cpp-bridge";

const TARGET_ASSEMBLY = "Assembly-CSharp";

console.log("[+] Script menu IL2CPP carregado");

Il2Cpp.perform(() => {
  Java.perform(() => {
    Java.scheduleOnMainThread(() => {
      criarMenu();
    });
  });
});

function criarMenu() {
  try {
    const UnityPlayer = Java.use("com.unity3d.player.UnityPlayer");
    const activity = UnityPlayer.currentActivity.value;

    if (activity == null) {
      console.log("[-] Activity nao encontrada");
      return;
    }

    const LinearLayout = Java.use("android.widget.LinearLayout");
    const TextView = Java.use("android.widget.TextView");
    const Button = Java.use("android.widget.Button");
    const ScrollView = Java.use("android.widget.ScrollView");
    const FrameLayout = Java.use("android.widget.FrameLayout");
    const GradientDrawable = Java.use("android.graphics.drawable.GradientDrawable");
    const Color = Java.use("android.graphics.Color");
    const Gravity = Java.use("android.view.Gravity");

    const decorView = activity.getWindow().getDecorView();
    const root = Java.cast(decorView, FrameLayout);

    const oldMenu = root.findViewWithTag("FRIDA_IL2CPP_MENU");

    if (oldMenu != null) {
      root.removeView(oldMenu);
    }

    const menu = LinearLayout.$new(activity);
    menu.setTag("FRIDA_IL2CPP_MENU");
    menu.setOrientation(LinearLayout.VERTICAL.value);
    menu.setPadding(dp(activity, 10), dp(activity, 10), dp(activity, 10), dp(activity, 10));

    const bg = GradientDrawable.$new();
    bg.setColor(Color.argb(230, 20, 20, 20));
    bg.setCornerRadius(dp(activity, 12));
    bg.setStroke(dp(activity, 2), Color.rgb(0, 200, 255));
    menu.setBackground(bg);

    const title = TextView.$new(activity);
    title.setText("⚙️ IL2CPP MENU");
    title.setTextColor(Color.rgb(0, 220, 255));
    title.setTextSize(16);
    title.setGravity(Gravity.CENTER.value);

    const info = TextView.$new(activity);
    info.setText("Clique em LISTAR CLASSES");
    info.setTextColor(Color.WHITE.value);
    info.setTextSize(12);
    info.setPadding(0, dp(activity, 8), 0, dp(activity, 8));

    const scroll = ScrollView.$new(activity);
    scroll.addView(info);

    const btnListar = Button.$new(activity);
    btnListar.setText("LISTAR CLASSES");

    const btnFechar = Button.$new(activity);
    btnFechar.setText("FECHAR");

    menu.addView(title);
    menu.addView(btnListar);
    menu.addView(scroll);
    menu.addView(btnFechar);

    const params = FrameLayout.LayoutParams.$new(
      dp(activity, 300),
      dp(activity, 360)
    );

    params.leftMargin = dp(activity, 20);
    params.topMargin = dp(activity, 120);

    root.addView(menu, params);

    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const TouchListener = Java.registerClass({
      name: "com.frida.menu.TouchListener" + Date.now(),
      implements: [Java.use("android.view.View$OnTouchListener")],
      methods: {
        onTouch(v, event) {
          const action = event.getAction();

          if (action === 0) {
            startX = event.getRawX();
            startY = event.getRawY();
            startLeft = params.leftMargin;
            startTop = params.topMargin;
            return true;
          }

          if (action === 2) {
            const dx = event.getRawX() - startX;
            const dy = event.getRawY() - startY;

            params.leftMargin = startLeft + dx;
            params.topMargin = startTop + dy;

            menu.setLayoutParams(params);
            return true;
          }

          return true;
        }
      }
    });

    title.setOnTouchListener(TouchListener.$new());

    const ListarClick = Java.registerClass({
      name: "com.frida.menu.ListarClick" + Date.now(),
      implements: [Java.use("android.view.View$OnClickListener")],
      methods: {
        onClick(v) {
          try {
            const texto = pegarInfoIl2Cpp();
            info.setText(texto);
            console.log(texto);
          } catch (e) {
            const erro = "Erro: " + e;
            info.setText(erro);
            console.log(erro);
          }
        }
      }
    });

    const FecharClick = Java.registerClass({
      name: "com.frida.menu.FecharClick" + Date.now(),
      implements: [Java.use("android.view.View$OnClickListener")],
      methods: {
        onClick(v) {
          try {
            root.removeView(menu);
          } catch (e) {
            console.log("Erro fechando menu: " + e);
          }
        }
      }
    });

    btnListar.setOnClickListener(ListarClick.$new());
    btnFechar.setOnClickListener(FecharClick.$new());

    console.log("[+] Menu flutuante criado");

  } catch (e) {
    console.log("[-] Erro criando menu: " + e);
  }
}

function pegarInfoIl2Cpp() {
  let out = "";

  out += "Unity: " + Il2Cpp.unityVersion + "\n\n";
  out += "Assemblies: " + Il2Cpp.domain.assemblies.length + "\n";

  const assembly = Il2Cpp.domain.assembly(TARGET_ASSEMBLY);

  if (assembly == null) {
    out += "\nAssembly-CSharp nao encontrada.\n\n";
    out += "Assemblies disponiveis:\n";

    for (const asm of Il2Cpp.domain.assemblies) {
      out += "- " + asm.image.name + "\n";
    }

    return out;
  }

  const image = assembly.image;
  const classes = image.classes;

  out += "Assembly: " + image.name + "\n";
  out += "Total classes: " + classes.length + "\n\n";
  out += "Primeiras classes:\n";

  for (let i = 0; i < classes.length && i < 100; i++) {
    const klass = classes[i];
    out += i + ". " + klass.name + "\n";
  }

  if (classes.length > 100) {
    out += "\n... mais " + (classes.length - 100) + " classes";
  }

  return out;
}

function dp(activity, value) {
  const density = activity.getResources().getDisplayMetrics().density.value;
  return Math.floor(value * density);
}