FK KNV — klikateľný prototyp

Spustenie: rozbaľte ZIP a otvorte index.html v prehliadači.
Alternatíva: python3 -m http.server 8080 v rozbalenom adresári.

Obsah: domov, mužstvá, profil hráča, vyhľadávanie, kalendár s filtrami, export ICS, klub, história, funkcionári, zverejňovanie, kontakty a galéria.

Súpisky a udalosti sú ukážkové; živé API fkknv.sk nie je pripojené. Ukážka hráčskych kariet je v U15. Ostatné kategórie majú navigáciu a ukážkový program. Pri implementácii treba nahradiť demo adaptér v app.js autorizovaným zdrojom dát. Verejné fotografie a osobné údaje musia byť schválené klubom.

Fiktívne AI portréty vo veku približne 13–15 rokov, modré dresy s oficiálnym erbom FK Košická Nová Ves podľa klubovej predlohy. Nejde o fotografie skutočných členov klubu. Absolútnu neprítomnosť náhodnej podobnosti nemožno zaručiť.

Zdroje: https://www.fkkosickanovaves.sk/ (rubriky, história, funkcionári, kontakty); https://fkknv.sk/ (erb, prihlásenie, registrácia). Staršie klubové údaje majú odkazy na zdroj a nepotvrdenú platnosť pre 2026/27.

Overenie: syntax JavaScriptu, zobrazenie v prehliadači, mobilné menu, responzívna šírka, detail hráča, prechod do programu tímu, filtrovanie tréningov, detail udalosti a vyhľadávanie hráča.

Písma Barlow a Barlow Condensed sa načítavajú z Google Fonts; pri offline zobrazení sa použijú systémové náhrady.
