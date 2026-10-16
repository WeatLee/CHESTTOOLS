// Narration scripts for the step captions: one entry per step, in the same order as the
// steps in demos.js / ctguide.js / auscultation.js. `zh` is spoken aloud only (the page
// already shows the Chinese caption); the other languages are also shown on screen.
// Translations were written by Claude and are NOT yet reviewed by native speakers or
// clinicians: they carry the same "schematic, not a real case" status as the page.
export const LANGS = [
  { id: 'zh', label: '中文', voice: 'zh-TW-HsiaoChenNeural', htmlLang: 'zh-TW' },
  { id: 'en', label: 'English (US)', voice: 'en-US-JennyNeural', htmlLang: 'en-US' },
  { id: 'nan', label: '台語', voice: null, htmlLang: 'nan-TW' }, // no neural voice in the TTS service; see voice/README.md
  { id: 'vi', label: 'Tiếng Việt', voice: 'vi-VN-HoaiMyNeural', htmlLang: 'vi' },
  { id: 'ms', label: 'Bahasa Melayu', voice: 'ms-MY-YasminNeural', htmlLang: 'ms' },
  { id: 'id', label: 'Bahasa Indonesia', voice: 'id-ID-GadisNeural', htmlLang: 'id' }
];

export const VOICE_TEXT = {
  bronch: [
    {
      zh: ['進入氣管', '麻醉後，細長的支氣管鏡從鼻腔或口腔進入，經過喉嚨到達氣管。'],
      en: ["Entering the windpipe", "After numbing medicine, a thin, flexible bronchoscope is passed through the nose or mouth, down the throat and into the windpipe."],
      vi: ['Vào khí quản', 'Sau khi gây tê, ống soi phế quản mảnh và dài đi vào qua mũi hoặc miệng, qua cổ họng rồi đến khí quản.'],
      ms: ['Masuk ke trakea', 'Selepas pembiusan, bronkoskop yang nipis dan panjang dimasukkan melalui hidung atau mulut, melalui tekak sehingga sampai ke trakea.'],
      id: ['Masuk ke trakea', 'Setelah pembiusan, bronkoskop yang tipis dan panjang dimasukkan melalui hidung atau mulut, melewati tenggorokan hingga mencapai trakea.']
    },
    {
      zh: ['進入右側主支氣管', '沿著氣管往下，到氣管分岔的地方（隆突）後，轉進右側的主支氣管。'],
      en: ["Into the right main airway", "It follows the windpipe down to where it splits (the carina), then turns into the right main airway."],
      vi: ['Vào phế quản gốc bên phải', 'Đi dọc khí quản xuống chỗ khí quản chia đôi (carina), rồi rẽ vào phế quản gốc bên phải.'],
      ms: ['Masuk ke bronkus utama kanan', 'Mengikut trakea ke bawah sehingga tempat trakea bercabang (karina), kemudian membelok masuk ke bronkus utama sebelah kanan.'],
      id: ['Masuk ke bronkus utama kanan', 'Menyusuri trakea ke bawah sampai tempat trakea bercabang (karina), lalu berbelok masuk ke bronkus utama sebelah kanan.']
    },
    {
      zh: ['接近腫瘤', '轉進右上葉的前段支氣管，鏡頭靠近黃色標示的腫瘤位置。'],
      en: ["Approaching the tumor", "It turns into the front branch of the right upper lobe, and the camera moves close to the tumor marked in yellow."],
      vi: ['Tiến gần khối u', 'Rẽ vào phế quản phân thùy trước của thùy trên phổi phải, đầu ống soi đến gần vị trí khối u được đánh dấu màu vàng.'],
      ms: ['Menghampiri tumor', 'Membelok masuk ke bronkus segmen anterior lobus atas kanan, dan kamera menghampiri lokasi tumor yang ditandakan berwarna kuning.'],
      id: ['Mendekati tumor', 'Berbelok masuk ke bronkus segmen anterior lobus atas kanan, dan kamera mendekati lokasi tumor yang ditandai warna kuning.']
    },
    {
      zh: ['夾取組織', '取樣鉗從鏡子前端伸出，夾取少量組織送去做病理檢查。'],
      en: ["Taking a tissue sample", "Biopsy forceps extend from the tip of the scope and take a tiny piece of tissue to send for pathology."],
      vi: ['Lấy mẫu mô', 'Kìm sinh thiết thò ra từ đầu ống soi, gắp một mẩu mô nhỏ gửi đi làm xét nghiệm giải phẫu bệnh.'],
      ms: ['Mengambil tisu', 'Forsep biopsi dijulurkan keluar dari hujung bronkoskop untuk mengambil sedikit tisu dan dihantar untuk pemeriksaan patologi.'],
      id: ['Mengambil jaringan', 'Forsep biopsi dijulurkan keluar dari ujung bronkoskop untuk mengambil sedikit jaringan, lalu dikirim untuk pemeriksaan patologi.']
    }
  ],
  tbna: [
    {
      zh: ['鏡子進入氣管', '超音波支氣管鏡前端有一個小型超音波探頭，沿著氣管前進到氣管分岔處的下方。'],
      en: ["Scope enters the windpipe", "The tip of the ultrasound bronchoscope carries a small ultrasound probe. It moves down the windpipe to just below where the airways split."],
      vi: ['Ống soi vào khí quản', 'Đầu ống soi phế quản siêu âm có một đầu dò siêu âm nhỏ, tiến dọc khí quản đến phía dưới chỗ khí quản chia đôi.'],
      ms: ['Skop masuk ke trakea', 'Hujung bronkoskop ultrasound mempunyai prob ultrasound kecil, yang bergerak di sepanjang trakea sehingga ke bawah tempat trakea bercabang.'],
      id: ['Skop masuk ke trakea', 'Ujung bronkoskop ultrasonografi memiliki probe ultrasonografi kecil, yang bergerak menyusuri trakea sampai ke bawah tempat trakea bercabang.']
    },
    {
      zh: ['用超音波找到淋巴結', '探頭貼住氣管壁，在超音波畫面中找到隆突下方的淋巴結（黃色標示），並確認旁邊沒有大血管。'],
      en: ["Finding the lymph node with ultrasound", "The probe rests against the airway wall. On the ultrasound screen, the doctor finds the lymph node below the carina, marked in yellow, and checks that no large blood vessel is next to it."],
      vi: ['Tìm hạch bằng siêu âm', 'Đầu dò áp sát thành khí quản, tìm hạch bạch huyết dưới carina trên màn hình siêu âm (đánh dấu màu vàng) và kiểm tra bên cạnh không có mạch máu lớn.'],
      ms: ['Mencari nodus limfa dengan ultrasound', 'Prob ditekap pada dinding trakea, nodus limfa di bawah karina (ditandakan kuning) dicari pada skrin ultrasound, dan dipastikan tiada saluran darah besar di sebelahnya.'],
      id: ['Mencari kelenjar getah bening dengan USG', 'Probe ditempelkan pada dinding trakea, kelenjar getah bening di bawah karina (ditandai kuning) dicari pada layar USG, dan dipastikan tidak ada pembuluh darah besar di dekatnya.']
    },
    {
      zh: ['細針穿過氣管壁', '在超音波的即時引導下，細針穿過氣管壁刺入淋巴結。'],
      en: ["Needle through the airway wall", "Guided live by ultrasound, a thin needle passes through the airway wall into the lymph node."],
      vi: ['Kim nhỏ xuyên qua thành khí quản', 'Dưới hướng dẫn siêu âm trực tiếp, kim nhỏ xuyên qua thành khí quản đâm vào hạch bạch huyết.'],
      ms: ['Jarum halus menembusi dinding trakea', 'Dengan panduan ultrasound masa nyata, jarum halus menembusi dinding trakea dan masuk ke dalam nodus limfa.'],
      id: ['Jarum halus menembus dinding trakea', 'Dengan panduan USG secara langsung, jarum halus menembus dinding trakea dan masuk ke dalam kelenjar getah bening.']
    },
    {
      zh: ['抽吸取樣', '針在淋巴結內來回抽吸，取得細胞或少量組織，送去檢查。'],
      en: ["Collecting the sample", "The needle moves back and forth inside the lymph node to collect cells or a small piece of tissue for testing."],
      vi: ['Hút lấy mẫu', 'Kim di chuyển qua lại trong hạch để hút lấy tế bào hoặc một ít mô, gửi đi xét nghiệm.'],
      ms: ['Sedutan untuk sampel', 'Jarum digerakkan ke depan dan ke belakang di dalam nodus limfa untuk menyedut sel atau sedikit tisu, dan dihantar untuk pemeriksaan.'],
      id: ['Aspirasi untuk sampel', 'Jarum digerakkan maju mundur di dalam kelenjar getah bening untuk menyedot sel atau sedikit jaringan, lalu dikirim untuk pemeriksaan.']
    }
  ],
  ct: [
    {
      zh: ['檢查前掃描', '病人躺在檢查台上，皮膚貼上有刻度的標記貼。先做電腦斷層掃描，找到腫瘤（黃色）的位置。'],
      en: ["Scan before the procedure", "The patient lies on the scanner table with a ruled marker sticker on the skin. A CT scan is done first to find the tumor, shown in yellow."],
      vi: ['Chụp trước khi thực hiện', 'Bệnh nhân nằm trên bàn, trên da dán miếng đánh dấu có vạch chia. Trước tiên chụp cắt lớp vi tính để tìm vị trí khối u (màu vàng).'],
      ms: ['Imbasan sebelum prosedur', 'Pesakit berbaring di atas katil pemeriksaan, dan pelekat penanda berskala dilekatkan pada kulit. Imbasan CT dibuat dahulu untuk mencari lokasi tumor (kuning).'],
      id: ['Pemindaian sebelum tindakan', 'Pasien berbaring di meja pemeriksaan, dan stiker penanda berskala ditempelkan pada kulit. Pemindaian CT dilakukan dahulu untuk menemukan lokasi tumor (kuning).']
    },
    {
      zh: ['規劃安全的針道', '在影像上選一條最短、又能避開肋骨、大血管和心臟的路徑，量出皮膚到腫瘤的距離。'],
      en: ["Planning a safe needle path", "On the images, the doctor picks the shortest path that avoids ribs, large blood vessels and the heart, and measures the distance from the skin to the tumor."],
      vi: ['Lên kế hoạch đường kim an toàn', 'Trên hình ảnh chọn đường ngắn nhất và tránh được xương sườn, mạch máu lớn và tim, rồi đo khoảng cách từ da đến khối u.'],
      ms: ['Merancang laluan jarum yang selamat', 'Pada imej, dipilih laluan terpendek yang mengelak tulang rusuk, saluran darah besar dan jantung, kemudian jarak dari kulit ke tumor diukur.'],
      id: ['Merencanakan jalur jarum yang aman', 'Pada gambar dipilih jalur terpendek yang menghindari tulang rusuk, pembuluh darah besar dan jantung, lalu jarak dari kulit ke tumor diukur.']
    },
    {
      zh: ['局部麻醉', '消毒、鋪單後，把麻醉藥打在皮膚到胸膜的路徑上，讓穿刺時比較不痛。'],
      en: ["Local anesthesia", "After the skin is cleaned and draped, numbing medicine is injected along the path from the skin to the lining of the lung, so the needle hurts less."],
      vi: ['Gây tê tại chỗ', 'Sau khi sát trùng và trải khăn, thuốc tê được tiêm dọc đường từ da đến màng phổi để khi chọc kim ít đau hơn.'],
      ms: ['Bius setempat', 'Selepas pembersihan dan penutupan dengan kain steril, ubat bius disuntik di sepanjang laluan dari kulit ke pleura supaya penusukan kurang sakit.'],
      id: ['Bius lokal', 'Setelah pembersihan dan penutupan dengan kain steril, obat bius disuntikkan di sepanjang jalur dari kulit ke pleura agar penusukan tidak terlalu sakit.']
    },
    {
      zh: ['沿著影像導引進針', '導引針一小段一小段往前推，每推一段就再掃描一次，確認針尖方向正確，直到靠近腫瘤邊緣。'],
      en: ["Advancing the needle with image guidance", "The guide needle is advanced a little at a time. After each step, another scan checks that the tip is pointing the right way, until it is near the edge of the tumor."],
      vi: ['Đưa kim theo hình ảnh dẫn đường', 'Kim dẫn đường được đẩy từng đoạn ngắn, mỗi lần đẩy lại chụp lại một lần để xác nhận hướng đầu kim đúng, cho đến khi gần mép khối u.'],
      ms: ['Memasukkan jarum mengikut panduan imej', 'Jarum pemandu ditolak sedikit demi sedikit, dan imbasan diulang setiap kali untuk memastikan arah hujung jarum betul, sehingga hampir ke tepi tumor.'],
      id: ['Memasukkan jarum mengikuti panduan gambar', 'Jarum pemandu didorong sedikit demi sedikit, dan pemindaian diulang setiap kali untuk memastikan arah ujung jarum benar, sampai dekat tepi tumor.']
    },
    {
      zh: ['取得組織', '取樣針從導引針裡伸出，快速取出細長的組織條，通常會取 2 到 3 條，送去做病理檢查。'],
      en: ["Collecting tissue", "A biopsy needle passes through the guide needle and quickly takes thin strips of tissue, usually two or three, to send for pathology."],
      vi: ['Lấy mẫu mô', 'Kim sinh thiết thò ra từ kim dẫn đường, nhanh chóng lấy ra những sợi mô nhỏ dài, thường lấy 2 đến 3 sợi, gửi đi làm xét nghiệm giải phẫu bệnh.'],
      ms: ['Mendapatkan tisu', 'Jarum biopsi dijulurkan keluar dari jarum pemandu, dan jalur tisu halus diambil dengan cepat, biasanya 2 hingga 3 jalur, lalu dihantar untuk pemeriksaan patologi.'],
      id: ['Mengambil jaringan', 'Jarum biopsi dijulurkan keluar dari jarum pemandu, dan serpihan jaringan halus diambil dengan cepat, biasanya 2 sampai 3 serpihan, lalu dikirim untuk pemeriksaan patologi.']
    },
    {
      zh: ['退針與觀察', '把針拔出，按壓傷口。檢查後會再拍胸部影像，觀察有沒有氣胸或出血。'],
      en: ["Removing the needle and watching", "The needle is taken out and pressure is held on the spot. A chest image is taken afterward to check for a collapsed lung or bleeding."],
      vi: ['Rút kim và theo dõi', 'Rút kim ra và ép vết chọc. Sau thủ thuật sẽ chụp lại hình ngực để xem có tràn khí màng phổi hoặc chảy máu hay không.'],
      ms: ['Menarik jarum dan pemerhatian', 'Jarum ditarik keluar dan luka ditekan. Selepas prosedur, imej dada diambil semula untuk melihat sama ada ada pneumotoraks atau pendarahan.'],
      id: ['Mencabut jarum dan observasi', 'Jarum dicabut dan luka ditekan. Setelah tindakan, foto dada diambil lagi untuk melihat apakah ada pneumotoraks atau perdarahan.']
    }
  ],
  drain: [
    {
      zh: ['超音波定位', '先用超音波看到積水的位置，在皮膚上做記號，並選一個肋骨之間比較安全的位置。'],
      en: ["Ultrasound marking", "Ultrasound first shows where the fluid is. The skin is marked, and a safe spot between two ribs is chosen."],
      vi: ['Định vị bằng siêu âm', 'Trước tiên dùng siêu âm xem vị trí có dịch, đánh dấu trên da và chọn một vị trí an toàn giữa các xương sườn.'],
      ms: ['Penentuan lokasi dengan ultrasound', 'Pertama, ultrasound digunakan untuk melihat lokasi cecair, tanda dibuat pada kulit, dan dipilih satu kedudukan yang lebih selamat di antara tulang rusuk.'],
      id: ['Penentuan lokasi dengan USG', 'Pertama, USG digunakan untuk melihat lokasi cairan, tanda dibuat pada kulit, dan dipilih satu tempat yang lebih aman di antara tulang rusuk.']
    },
    {
      zh: ['局部麻醉', '皮膚消毒後，用細針把麻醉藥打在皮膚到胸膜的路徑上，並抽到胸水，確認位置正確。'],
      en: ["Local anesthesia", "After the skin is cleaned, a thin needle puts numbing medicine along the path from the skin to the lining of the lung. Fluid is drawn back to confirm the position."],
      vi: ['Gây tê tại chỗ', 'Sau khi sát trùng da, dùng kim nhỏ tiêm thuốc tê dọc đường từ da đến màng phổi và hút ra dịch màng phổi để xác nhận đúng vị trí.'],
      ms: ['Bius setempat', 'Selepas kulit dibersihkan, ubat bius disuntik dengan jarum halus di sepanjang laluan dari kulit ke pleura, dan cecair pleura disedut untuk mengesahkan kedudukan betul.'],
      id: ['Bius lokal', 'Setelah kulit dibersihkan, obat bius disuntikkan dengan jarum halus di sepanjang jalur dari kulit ke pleura, dan cairan pleura disedot untuk memastikan posisinya benar.']
    },
    {
      zh: ['導管連同內針直接放入', '豬尾巴導管套在較硬的內針上，一起從兩根肋骨之間的縫隙直接穿過胸壁，進入胸腔（不需要導線）。'],
      en: ["Inserting the catheter over the inner needle", "The pigtail catheter sits over a stiffer inner needle. Together they pass through the gap between two ribs into the chest cavity, with no guide wire needed."],
      vi: ['Đặt ống cùng kim trong', 'Ống dẫn lưu đuôi lợn lồng trên kim trong cứng hơn, cùng xuyên qua thành ngực qua khe giữa hai xương sườn vào khoang ngực (không cần dây dẫn).'],
      ms: ['Memasukkan tiub bersama jarum dalam', 'Tiub saliran ekor khinzir disarungkan pada jarum dalam yang lebih keras, lalu bersama-sama menembusi dinding dada melalui ruang di antara dua tulang rusuk ke dalam rongga dada (tanpa wayar pemandu).'],
      id: ['Memasukkan selang bersama jarum dalam', 'Selang drainase pigtail dipasang pada jarum dalam yang lebih keras, lalu bersama-sama menembus dinding dada melalui celah di antara dua tulang rusuk ke rongga dada (tanpa kawat pemandu).']
    },
    {
      zh: ['退出內針，導管捲曲', '內針慢慢退出，導管繼續往胸腔裡送，前端自然捲成豬尾巴的形狀，避免滑出來。'],
      en: ["Withdrawing the needle, catheter curls", "The inner needle is slowly pulled out while the catheter is advanced. Its tip curls into a pigtail shape so it does not slip out."],
      vi: ['Rút kim trong, ống cuộn lại', 'Kim trong từ từ được rút ra, ống tiếp tục được đưa vào khoang ngực, đầu ống tự cuộn thành hình đuôi lợn để không bị tuột ra.'],
      ms: ['Menarik keluar jarum dalam, tiub menggulung', 'Jarum dalam ditarik keluar perlahan-lahan, tiub diteruskan masuk ke rongga dada, dan hujungnya menggulung secara semula jadi seperti ekor khinzir supaya tidak tergelincir keluar.'],
      id: ['Menarik jarum dalam, selang menggulung', 'Jarum dalam ditarik keluar perlahan-lahan, selang terus didorong masuk ke rongga dada, dan ujungnya menggulung secara alami seperti ekor babi agar tidak terlepas.']
    },
    {
      zh: ['胸水流出，肺張開', '胸水經由導管慢慢流出，水位下降，被壓住的肺再慢慢張開。'],
      en: ["Fluid drains, lung re-expands", "The fluid slowly drains through the catheter, the fluid level drops, and the squeezed lung gradually expands again."],
      vi: ['Dịch chảy ra, phổi nở ra', 'Dịch màng phổi từ từ chảy ra qua ống, mực dịch hạ xuống, phổi bị đè ép dần dần nở ra trở lại.'],
      ms: ['Cecair mengalir keluar, paru-paru mengembang', 'Cecair pleura mengalir keluar perlahan-lahan melalui tiub, paras cecair menurun, dan paru-paru yang tertekan mengembang semula secara perlahan.'],
      id: ['Cairan mengalir keluar, paru mengembang', 'Cairan pleura mengalir keluar perlahan melalui selang, permukaan cairan turun, dan paru yang tertekan mengembang kembali secara perlahan.']
    }
  ],
  sound: [
    {
      zh: ['選一種聲音', '正常、哮鳴音、細濕囉音、粗濕囉音、喘鳴音，點一下就能切換。'],
      en: ["Choose a sound", "Normal, wheeze, fine crackles, coarse crackles or stridor. Tap one to switch."],
      vi: ['Chọn một loại âm thanh', 'Âm bình thường, tiếng rít, ran nổ nhỏ, ran nổ to, tiếng thở rít thanh quản. Chạm một cái là đổi được.'],
      ms: ['Pilih satu jenis bunyi', 'Bunyi normal, wheezing, krepitasi halus, krepitasi kasar, dan stridor. Ketik sekali untuk bertukar.'],
      id: ['Pilih satu jenis suara', 'Suara normal, mengi, krepitasi halus, krepitasi kasar, dan stridor. Ketuk sekali untuk berganti.']
    },
    {
      zh: ['選聽診的位置', '點胸部圖上的圓點（前胸、背後各有每側 6 到 7 個位置），或直接點 3D 胸部上的小圓點。'],
      en: ["Choose where to listen", "Tap a dot on the chest picture, with six or seven spots on each side of the front and back, or tap a small dot on the 3D chest."],
      vi: ['Chọn vị trí nghe', 'Chạm vào các chấm tròn trên hình ngực (mặt trước và mặt sau, mỗi bên có 6 đến 7 vị trí), hoặc chạm trực tiếp vào chấm nhỏ trên ngực 3D.'],
      ms: ['Pilih lokasi auskultasi', 'Ketik titik bulat pada gambar dada (dada hadapan dan belakang, setiap sisi ada 6 hingga 7 lokasi), atau ketik terus titik kecil pada dada 3D.'],
      id: ['Pilih lokasi auskultasi', 'Ketuk titik bulat pada gambar dada (dada depan dan belakang, setiap sisi ada 6 sampai 7 lokasi), atau ketuk langsung titik kecil pada dada 3D.']
    },
    {
      zh: ['聽聲音、看波形', '聲音會一直循環播放，下方的波形會跟著移動。喘鳴音只有在喉嚨和頸部氣管（橘色圓點）聽得到。'],
      en: ["Listen and watch the waveform", "The sound loops, and the waveform below moves with it. Stridor can only be heard over the throat and neck windpipe, shown as orange dots."],
      vi: ['Nghe âm thanh, xem dạng sóng', 'Âm thanh sẽ phát lặp lại liên tục, dạng sóng bên dưới chuyển động theo. Tiếng thở rít chỉ nghe được ở họng và khí quản vùng cổ (chấm màu cam).'],
      ms: ['Dengar bunyi, lihat bentuk gelombang', 'Bunyi dimainkan berulang-ulang, dan bentuk gelombang di bawah bergerak mengikutinya. Stridor hanya boleh didengar di tekak dan trakea di leher (titik oren).'],
      id: ['Dengarkan suara, lihat bentuk gelombang', 'Suara diputar berulang-ulang, dan bentuk gelombang di bawah bergerak mengikutinya. Stridor hanya terdengar di tenggorokan dan trakea di leher (titik oranye).']
    }
  ]
};
