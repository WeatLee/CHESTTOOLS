/* 網站設定。上線前必須改 baseUrl，否則病人掃 QR 會打不開。 */
window.SDM_CONFIG = {
  /* 正式網址（以 / 結尾），例如 'https://xxx.github.io/lung-cancer-sdm/'。
     留空時 QR 會指向目前這台電腦的位置，病人手機掃不開。 */
  baseUrl: 'https://weatlee.github.io/CHESTTOOLS/Tools/lung-cancer-sdm/',
  /* true 時病人頁頂端顯示「草稿：內容待校對」。使用者校對完畢後改成 false。 */
  draft: true
};
