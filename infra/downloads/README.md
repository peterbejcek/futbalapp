# Súbory na stiahnutie (mobilná aplikácia)

Caddy servíruje tento priečinok na `https://fkknv.sk/stiahnut/`.

## Aktualizácia Android aplikácie (APK)
Po dobehnutí EAS buildu:
1. Stiahni APK z EAS (odkaz „Download build" na stránke buildu alebo `eas build:list`).
2. Nahraj ho na server presne pod týmto názvom (odkaz na webe je fixný):
   ```
   scp fkknv.apk root@45.43.166.60:/opt/fkknv/app/infra/downloads/fkknv.apk
   ```
3. Hotovo — trvalý odkaz `https://fkknv.sk/stiahnut/fkknv.apk` teraz vracia novú verziu.
   (Netreba rebuildovať web ani reštartovať Caddy.)
