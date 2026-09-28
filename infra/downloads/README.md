# Súbory na stiahnutie (mobilná aplikácia)

Caddy servíruje tento priečinok na `https://fkknv.sk/stiahnut/`.

## Aktualizácia Android aplikácie (APK)

⚠️ **Dôležité — kanál OTA:** APK na sideload staviame profilom **`production-apk`**
(inštalovateľné APK na kanáli **`production`**). Profil `preview` počúva kanál
`preview`, takže APK z neho **nedostáva** OTA publikované cez
`eas update --branch production`. Preto pre APK, ktoré tu hostíme, používaj
`production-apk` — potom jeden `eas update --branch production` pokryje iOS aj
Android APK aj (neskôr) Google Play.

Po dobehnutí EAS buildu:
1. Postav inštalovateľné APK na produkčnom kanáli:
   ```
   cd apps/mobile
   eas build --profile production-apk --platform android
   ```
2. Stiahni APK z EAS (odkaz „Download build" na stránke buildu alebo `eas build:list --platform android`).
   (Profil `production` stavia `.aab` pre Google Play — to sa **nedá** sideloadovať.)
3. Nahraj ho na server presne pod týmto názvom (odkaz na webe je fixný):
   ```
   scp fkknv.apk root@45.43.166.60:/opt/fkknv/app/infra/downloads/fkknv.apk
   ```
4. Hotovo — trvalý odkaz `https://fkknv.sk/stiahnut/fkknv.apk` teraz vracia novú verziu.
   (Netreba rebuildovať web ani reštartovať Caddy.)
