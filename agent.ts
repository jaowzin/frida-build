import "frida-il2cpp-bridge";

const TARGET_ASSEMBLY = "Assembly-CSharp";

console.log("[+] Script menu IL2CPP carregado");

Il2Cpp.perform(() => {
  Java.perform(() => {
    createFloatingMenu();
  });
});

function createFloatingMenu() {
  Java.scheduleOnMainThread(() => {
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
      const View = Java.use("android.view.View");

      const decorView = activity.getWindow().getDecorView();
      const root = Java.cast(decorView, FrameLayout);

      const old = root.findViewWithTag("FRIDA_IL2CPP_MENU");
      if (old != null) {
        root.removeView(old);
      }

      const menu = LinearLayout.$new(activity);
      menu.setTag("FRIDA_IL2CPP_MENU");
      menu.setOrientation(LinearLayout.VERTICAL.value);
      menu.setPadding(dp(activity, 10), dp(activity, 10), dp(activity, 10), dp(activity, 10));

      const bg = GradientDrawable.$new();
      bg.setColor(Color.argb(220, 20, 20, 20));
      bg.setCornerRadius(dp(activity, 12));
      bg.setStroke(dp(activity, 2), Color.rgb(0, 200, 255));
      menu.setBackground(bg);

      const title = TextView.$new(activity);
      title.setText("⚙️ Frida IL2CPP Menu");
      title.setTextColor(Color.rgb(0, 220, 255));
      title.setTextSize(16);
      title.setGravity(Gravity.CENTER.value);
      menu.addView(title);

      const info = TextView.$new(activity);
      info.setText("Clique no botão para listar infos.");
      info.setTextColor(Color.WHITE.value);
      info.setTextSize(12);
      info.setPadding(0, dp(activity, 8), 0, dp(activity, 8));

      const scroll = ScrollView.$new(activity);
      scroll.addView(info);

      const btnInfo = Button.$new(activity);
      btnInfo.setText("Listar classes");

      const btnClose = Button.$new(activity);
      btnClose.setText("Fechar menu");

      menu.addView(btnInfo);
      menu.addView(scroll);
      menu.addView(btnClose);

      const params = FrameLayout.LayoutParams.$new(
        dp(activity, 300),
        dp(activity, 350)
      );

      params.leftMargin = dp(activity, 20);
      params.topMargin = dp(activity, 120);

      root.addView(menu, params);

      let lastX = 0;
      let lastY = 0;
      let startLeft = 0;
      let startTop = 0;

      const TouchListener = Java.registerClass({
        name: "com.frida.il2cpp.MenuTouchListener" + Date.now(),
        implements: [Java.use("android.view.View$OnTouchListener")],
        methods: {
          onTouch(v: any, event: any) {
            const action = event.getAction();

            if (action === 0) {
              lastX = event.getRawX();
              lastY = event.getRawY();
              startLeft = params.leftMargin;
              startTop = params.topMargin;
              return true;
            }

            if (action === 2) {
              const dx = event.getRawX() - lastX;
              const dy = event.getRawY() - lastY;

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

      const InfoClick = Java.registerClass({
        name: "com.frida.il2cpp.InfoClickListener" + Date.now(),
        implements: [Java.use("android.view.View$OnClickListener")],
        methods: {
          onClick(v: any) {
            try {
              const result = getIl2CppInfo();
              info.setText(result);
              console.log(result);
            } catch (e) {
              const err = "Erro ao listar IL2CPP: " + e;
              info.setText(err);
              console.log(err);
            }
          }
        }
      });

      const CloseClick = Java.registerClass({
        name: "com.frida.il2cpp.CloseClickListener" + Date.now(),
        implements: [Java.use("android.view.View$OnClickListener")],
        methods: {
          onClick(v: any) {
            try {
              root.removeView(menu);
            } catch (e) {
              console.log("Erro fechando menu: " + e);
            }
          }
        }
      });

      btnInfo.setOnClickListener(InfoClick.$new());
      btnClose.setOnClickListener(CloseClick.$new());

      console.log("[+] Menu flutuante criado");

    } catch (e) {
      console.log("[-] Erro criando menu: " + e);
    }
  });
}

function getIl2CppInfo(): string {
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
  out += "Classes: " + classes.length + "\n\n";

  out += "Primeiras classes:\n";

  for (let i = 0; i < classes.length && i < 80; i++) {
    const klass = classes[i];
    out += i + ". " + klass.name + "\n";
  }

  if (classes.length > 80) {
    out += "\n... mais " + (classes.length - 80) + " classes";
  }

  return out;
}

function dp(activity: any, value: number): number {
  const density = activity.getResources().getDisplayMetrics().density.value;
  return Math.floor(value * density);
}