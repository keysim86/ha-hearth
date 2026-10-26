// Kody kart lojalnościowych do zeskanowania przy kasie, liczone w panelu — numer karty nie trafia do żadnego
// zewnętrznego generatora. EAN-13 (PAYBACK; z zerem na początku to UPC-A), PDF417 (Moja Biedronka), Code 128 / GS1-128
// i QR (Lidl Plus; wersje 1–6, korekcja M, tryb liczbowy albo bajtowy).

// ---- EAN-13 ----

const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_R = EAN_L.map((p) => [...p].map((b) => (b === "1" ? "0" : "1")).join(""));
const EAN_G = EAN_R.map((p) => [...p].reverse().join(""));
/** Układ L/G sześciu cyfr lewej połowy zależnie od pierwszej cyfry (ona sama nie ma kresek). */
const EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export const eanValid = (code: string): boolean => {
  if (!/^\d{13}$/.test(code)) return false;
  const sum = [...code.slice(0, 12)].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
};

/** 95 modułów EAN-13 („1” = kreska) albo null, gdy treść nie jest 13 cyframi z poprawną cyfrą kontrolną. */
export function ean13(code: string): string | null {
  if (!eanValid(code)) return null;
  const d = [...code].map(Number);
  const left = d.slice(1, 7).map((n, i) => (EAN_PARITY[d[0]][i] === "L" ? EAN_L : EAN_G)[n]).join("");
  const right = d.slice(7).map((n) => EAN_R[n]).join("");
  return `101${left}01010${right}101`;
}

// ---- Code 128 (GS1-128 = Code 128 z FNC1 na początku) ----

/** Szerokości kresek i przerw (kreska, przerwa, …) symboli 0–106; 103–105 = Start A/B/C, 106 = Stop. */
const C128 = ("212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 " +
  "123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 " +
  "111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 " +
  "231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 " +
  "141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 " +
  "124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 " +
  "311141 411131 211412 211214 211232 2331112").split(" ");

/** Moduły Code 128 („1” = kreska) albo null, gdy treść ma znaki spoza ASCII 32–126. Same cyfry: zestaw C (para cyfr
 *  na symbol, nieparzysta ostatnia cyfra w zestawie B), reszta: zestaw B. `gs1` = FNC1 zaraz po starcie (GS1-128). */
export function code128(text: string, gs1 = false): string | null {
  if (!text || !/^[\x20-\x7e]+$/.test(text)) return null;
  const v: number[] = [];
  if (/^\d{2,}$/.test(text)) {
    v.push(105);
    if (gs1) v.push(102);
    const pary = text.length - (text.length % 2);
    for (let i = 0; i < pary; i += 2) v.push(Number(text.slice(i, i + 2)));
    if (pary < text.length) v.push(100, text.charCodeAt(pary) - 32);
  } else {
    v.push(104);
    if (gs1) v.push(102);
    for (const ch of text) v.push(ch.charCodeAt(0) - 32);
  }
  v.push(v.reduce((a, x, i) => a + x * (i || 1), 0) % 103, 106);
  return v.map((x) => [...C128[x]].map((w, i) => (i % 2 ? "0" : "1").repeat(Number(w))).join("")).join("");
}

// ---- PDF417 (kompakcja bajtowa, korekcja błędów poziomu 2) ----

/** Wzorce kresek słów kodowych: 3 klastry × 929 (17 modułów; zapis: wartość − 0x10000, 4 cyfry szesnastkowe). Tablica
 *  ze specyfikacji PDF417 przepisana z pdf417gen (MIT, © 2016 Ivan Habunek). */
const PDF_TAB =
  "d5c0eaf0f57cd4e0ea78f53ea8c0d470a8605040a8305020adc0d6f0eb7cace0d678eb3e58c0ac7058605dc0aef0d77c5ce0ae78d73e5c70ae3c" +
  "5ef0af7c5e78af3e5f7cf5fad2e0e978f4bea4c0d270e93ca460d2384840a430d21c4820a4184810a6e0d378e9be4cc0a670d33c4c60a638d31e" +
  "4c30a61c4ee0a778d3be4e70a73c4e38a71e4f78a7be4f3c4f1ea2c0d170e8bca260d138e89e4440a230d11c4420a2184410440846c0a370d1bc" +
  "4660a338d19e4630a31c4618460c4770a3bc4738a39e471c47bca160d0b8e85e4240a130d09c4220a118d08e4210a10c4208a1064360a1b8d0de" +
  "4330a19c4318a18e430c4306a1de438e4140a0b0d05c4120a098d04e4110a08c4108a086410441b04198418c40a0d02ea04ca0464082cae0e578" +
  "f2be94c0ca70e53c9460ca38e51e28409430282096e0cb78e5be2cc09670cb3c2c6096382c302c182ee09778cbbe2e70973c2e382e1c2f7897be" +
  "2f3c2fbedac0ed70f6bcda60ed38f69eb440da30ed1cb420da18ed0eb410da0c92c0c970e4bcb6c09260c938e49eb660db38ed9e6c4024209218" +
  "c90e6c20b6186c1026c09370c9bc6ec026609338c99e6e60b738db9e6e3026186e18277093bc6f702738939e6f38b79e6f1c27bc6fbc279e6f9e" +
  "d960ecb8f65eb240d930ec9cb220d918ec8eb210d90cb208b2049160c8b8e45eb3609130c89c66402220d99cc88e66202210910c6610b30c9106" +
  "2204236091b8c8de67602330919c6730b39c918e6718230c230623b891de67b8239c679c238e678e67deb140d8b0ec5cb120d898ec4eb110d88c" +
  "b108d886b104b102214090b0c85c634021209098c84e6320b198d8ce6310210890866308b186630421b090dc63b0219890ce6398b1ce638c2186" +
  "638663dc63ceb0a0d858ec2eb090d84cb088d846b084b08220a09058c82e61a02090904c6190b0cc9046618820846184208220d861d861cc61c6" +
  "d82cd826b042902c204860c860c460c28ac0c570e2bc8a60c53814408a30c51c14208a181410140816c08b70c5bc16608b38c59e16308b1c1618" +
  "160c17708bbc17388b9e171c17bc179ecd60e6b8f35e9a40cd30e69c9a20cd18e68e9a10cd0c9a08cd068960c4b8e25e9b608930c49c36401220" +
  "cd9cc48e36209b18890c361012083608136089b8c4de37601330cdde37309b9c898e3718130c370c13b889de37b8139c379c138e13de37dedd40" +
  "eeb0f75cdd20ee98f74edd10ee8cdd08ee86dd049940ccb0e65cbb409920eedce64ebb20dd98eecebb109908cc86bb08dd869902114088b0c45c" +
  "334011208898c44e774033209998ccce7720bb98ddce88867710330899867708110211b088dc33b0119888ce77b0339899ce7798bbce11863386" +
  "11dc33dc11ce77dc33cedca0ee58f72edc90ee4cdc88ee46dc84dc8298a0cc58e62eb9a09890ee6eb990dccccc46b9889884b9849882b98210a0" +
  "8858c42e31a01090884c73a0319098cc88467390b9cc1084738831841082318210d8886e31d810cc73d831cc10c673cc31c610ee73eedc50ee2c" +
  "dc48ee26dc44dc429850cc2cb8d09848cc26b8c8dc66b8c49842b8c21050882c30d01048882671d030c8986671c8b8e6104271c430c271c230ec" +
  "71ec71e6ee16dc22cc16982498221028306870e81022306285600a4085300a208518c28e0a10850c0a0885060b6085b8c2de0b30859c0b18858e" +
  "0b0c0b060bb885de0b9c0b8e0bde8d40c6b0e35c8d20c6988d10c68c8d08c6868d04094084b0c25c1b400920c6dcc24e1b208d98c6ce1b100908" +
  "84861b088d86090209b084dc1bb0099884ce1b988dce1b8c098609dc1bdc09ce1bcecea0e758f3aece90e74cce88e746ce84ce828ca0c6589da0" +
  "8c90c64c9d90ceccc6469d888c849d848c829d8208a0845819a00890c66e3ba019908ccc84463b909dcc08843b8819840882198208d8846e19d8" +
  "08cc3bd819cc08c63bcc19c608ee19ee3beeef50f7acef48f7a6ef44ef42ce50e72cded0ef6ce726dec8ef66dec4ce42dec28c50c62c9cd08c48" +
  "c626bdd09cc8ce66bdc8dee68c42bdc49cc2bdc20850842c18d00848842639d018c88c667bd039c89ce608427bc8bde618c27bc4086c18ec0866" +
  "39ec18e67bec39e67be6ef28f796ef24ef22ce28e716de68ef36de64ce22de628c28c6169c688c24bce89c648c22bce49c62bce2082884161868" +
  "8c3638e81864082279e838e4186279e438e279e2187679f6ef12de34de329c34bc74bc721834387478f478f205400520829805100508050405b0" +
  "0598058c058605dc05ce86a08690c34c8688c3468684868204a082580da086d8824c0d9086cc0d8886c60d8404820d8204d8826e0dd886ee0dcc" +
  "04c60dc604ee0deec750c748c744c74286508ed0c76cc3268ec8c7668ec486428ec204500cd0044882261dd00cc804441dc80cc404421dc40cc2" +
  "046c0cec04661dec0ce61de6e7a8e7a4e7a2c728cf68e7b6cf64c722cf628628c3168e68c7369ee88e6486229ee48e629ee2042882160c688636" +
  "1ce80c6404223de81ce40c623de41ce204360c761cf63df6f7d4f7d2e794efb4e792efb2c714cf34c712df74cf32df7286148e3486129e748e32" +
  "bef4f560fab8ea40f530fa9cea20f518fa8eea10f50cea08f506ea04eb60f5b8faded640eb30f59cd620eb18f58ed610eb0cd608eb06d604d760" +
  "ebb8f5deae40d730eb9cae20d718eb8eae10d70cae08d706ae04af60d7b8ebde5e40af30d79c5e20af18d78e5e10af0c5e08af065f60afb8d7de" +
  "5f30af9c5f18af8e5f0c5fb8afde5f9c5f8ee940f4b0fa5ce920f498fa4ee910f48ce908f486e904e902d340e9b0f4dcd320e998f4ced310e98c" +
  "d308e986d304d302a740d3b0e9dca720d398e9cea710d38ca708d386a704a7024f40a7b0d3dc4f20a798d3ce4f10a78c4f08a7864f044fb0a7dc" +
  "4f98a7ce4f8c4f864fdc4fcee8a0f458fa2ee890f44ce888f446e884e882d1a0e8d8f46ed190e8ccd188e8c6d184d182a3a0d1d8e8eea390d1cc" +
  "a388d1c6a384a38247a0a3d8d1ee4790a3cc4788a3c64784478247d8a3ee47cc47c647eee850f42ce848f426e844e842d0d0e86cd0c8e866d0c4" +
  "d0c2a1d0d0eca1c8d0e6a1c4a1c243d0a1ec43c8a1e643c443c243ec43e6e828f416e824e822d068e836d064d062a0e8d076a0e4a0e241e8a0f6" +
  "41e441e2e814e812d034d032a074a072e540f2b0f95ce520f298f94ee510f28ce508f286e504e502cb40e5b0f2dccb20e598f2cecb10e58ccb08" +
  "e586cb04cb029740cbb0e5dc9720cb98e5ce9710cb8c9708cb86970497022f4097b0cbdc2f209798cbce2f10978c2f0897862f042fb097dc2f98" +
  "97ce2f8c2f862fdc2fcef6a0fb586bf0f690fb4c69f8f688fb4668fcf684f682e4a0f258f92eeda0e490fb6eed90f6ccf246ed88e484ed84e482" +
  "ed82c9a0e4d8f26edba0c990e4ccdb90edcce4c6db88c984db84c982db8293a0c9d8e4eeb7a09390c9ccb790dbccc9c6b7889384b7849382b782" +
  "27a093d8c9ee6fa0279093cc6f90b7cc93c66f8827846f84278227d893ee6fd827cc6fcc27c66fc627eef650fb2c65f8f648fb2664fcf644647e" +
  "f642e450f22cecd0e448f226ecc8f666ecc4e442ecc2c8d0e46cd9d0c8c8e466d9c8ece6d9c4c8c2d9c291d0c8ecb3d091c8c8e6b3c8d9e6b3c4" +
  "91c2b3c223d091ec67d023c891e667c8b3e667c423c267c223ec67ec23e667e6f628fb1662fcf624627ef622e428f216ec68f636ec64e422ec62" +
  "c868e436d8e8c864d8e4c862d8e290e8c876b1e8d8f6b1e490e2b1e221e890f663e821e463e421e263e221f663f6f614617ef612e414ec34e412" +
  "ec32c834d874c832d8729074b0f49072b0f220f461f420f261f2f60ae40aec1ac81ad83a903ab07ae2a0f158f8aee290f14ce288f146e284e282" +
  "c5a0e2d8f16ec590e2ccc588e2c6c584c5828ba0c5d8e2ee8b90c5cc8b88c5c68b848b8217a08bd8c5ee17908bcc17888bc61784178217d88bee" +
  "17cc17c617eef350f9ac35f8f348f9a634fcf344347ef342e250f12ce6d0e248f126e6c8f366e6c4e242e6c2c4d0e26ccdd0c4c8e266cdc8e6e6" +
  "cdc4c4c2cdc289d0c4ec9bd089c8c4e69bc8cde69bc489c29bc213d089ec37d013c889e637c89be637c413c237c213ec37ec13e637e6fba875f0" +
  "bafcfba474f8ba7efba2747c743ef328f99632fcf768fbb676fc327ef764f322767ef762e228f116e668e224eee8f776e222eee4e662eee2c468" +
  "e236cce8c464dde8cce4c462dde4cce2dde288e8c47699e888e4bbe899e488e2bbe499e2bbe211e888f633e811e477e833e411e277e433e277e2" +
  "11f633f6fb9472f8b97efb92727c723ef314317ef734f312737ef732e214e634e212ee74e632ee72c434cc74c432dcf4cc72dcf2887498f48872" +
  "b9f498f2b9f210f431f410f273f431f273f2fb8a717c713ef30af71ae20ae61aee3ac41acc3adc7a883a987ab8fa107a30fa71fa70bee150f0ac" +
  "e148f0a6e144e142c2d0e16cc2c8e166c2c4c2c285d0c2ec85c8c2e685c485c20bd085ec0bc885e60bc40bc20bec0be6f1a8f8d61afcf1a41a7e" +
  "f1a2e128f096e368e124e364e122e362c268e136c6e8c264c6e4c262c6e284e8c2768de884e48de484e28de209e884f61be809e41be409e21be2" +
  "09f61bf6f9d43af89d7ef9d23a7c3a3ef194197ef3b4f1923b7ef3b2e114e334e112e774e332e772c234c674c232cef4c672cef284748cf48472" +
  "9df48cf29df208f419f408f23bf419f23bf27af0bd7c7a78bd3e7a3c7a1ef9ca397cfbda7b7c393e7b3ef18af39af7bae10ae31ae73aef7ac21a" +
  "c63ace7adefa843a8c7a9cfabdfa087a18fa39fa7978bcbe793c791e38be79be78bc789e785ee0a8e0a4e0a2c168e0b6c164c16282e8c17682e4" +
  "82e205e882f605e405e205f6f0d40d7ef0d2e094e1b4e092e1b2c134c374c132c372827486f4827286f204f40df404f20df2f8ea1d7c1d3ef0ca" +
  "f1dae08ae19ae3bac11ac33ac77a823a867a8efa047a0cfa1dfa3d789ebe3d3c3d1e1cbe3dbe7d70bebc7d38be9e7d1c7d0e3cbc7dbc3c9e7d9e" +
  "7cb8be5e7c9c7c8e3c5e7cde7c5c7c4e7c2ec0b4c0b28174817202f402f2e0dac09ac1ba813a837a027a06fa0ebe1ebc1e9e3eb89f5e3e9c3e8e" +
  "1e5e3ede7eb0bf5c7e98bf4e7e8c7e863e5c7edc3e4e7ece7e58bf2e7e4c7e463e2e7e6e7e2c7e260f5e1f5c1f4e3f589fae3f4c3f461f2e3f6e" +
  "3f2c3f26abe0d5f853c0a9f0d4fc51e0a8f8d47e50f0a87c5078fad05be0adf8fac859f0acfcfac458f8ac7efac2587cf5d0faec5df8f5c8fae6" +
  "5cfcf5c45c7ef5c2ebd0f5ecebc8f5e6ebc4ebc2d7d0ebecd7c8ebe6d7c4d7c2afd0d7ecafc8d7e6afc44bc0a5f0d2fc49e0a4f8d27e48f0a47c" +
  "4878a43e483cfa684df0a6fcfa644cf8a67efa624c7c4c3ef4e8fa764efcf4e44e7ef4e2e9e8f4f6e9e4e9e2d3e8e9f6d3e4d3e2a7e8d3f6a7e4" +
  "a7e245e0a2f8d17e44f0a27c4478a23e443c441efa3446f8a37efa32467c463ef474477ef472e8f4e8f2d1f4d1f2a3f4a3f242f0a17c4278a13e" +
  "423c421efa1a437c433ef43ae87ad0fa4178a0be413c411e41be40bc409e2bc095f0cafc29e094f8ca7e28f0947c2878943e283cf9682df096fc" +
  "f9642cf8967ef9622c7c2c3ef2e8f9762efcf2e42e7ef2e2e5e8f2f6e5e4e5e2cbe8e5f6cbe4cbe297e8cbf697e497e2b5e0daf8ed7e69c0b4f0" +
  "da7c68e0b478da3e6870b43c6838b41e681c25e092f8c97e6de024f0927c6cf0b67c923e6c78243c6c3c241e6c1ef93426f8937efb74f9326ef8" +
  "267cfb726e7c263e6e3ef274277ef6f4f2726f7ef6f2e4f4edf4e4f2edf2c9f4dbf4c9f2dbf293f493f265c0b2f0d97c64e0b278d93e6470b23c" +
  "6438b21e641c640e22f0917c66f02278913e6678b33e663c221e661ef91a237cfb3a677c233e673ef23af67ae47aecfac8fad9fa91fa62e0b178" +
  "d8be6270b13c6238b11e621c620e217890be6378213c633c211e631e21be63be6170b0bc6138b09e611c610e20bc61bc209e619e60b8b05e609c" +
  "608e205e60de605c604e15e08af8c57e14f08a7c14788a3e143c141ef8b416f88b7ef8b2167c163ef174177ef172e2f4e2f2c5f4c5f28bf48bf2" +
  "35c09af0cd7c34e09a78cd3e34709a3c34389a1e341c340e12f0897c36f01278893e36789b3e363c121e361ef89a137cf9ba377c133e373ef13a" +
  "f37ae27ae6fac4facdfa89fabae0dd78eebe74c0ba70dd3c7460ba38dd1e7430ba1c7418ba0e740c32e09978ccbe76e03270993c7670bb3c991e" +
  "7638321c761c320e760e117888be3378113c7778333c111e773c331e771e11be33be77be72c0b970dcbc7260b938dc9e7230b91c7218b90e720c" +
  "7206317098bc73703138989e7338b99e731c310e730e10bc31bc109e73bc319e739e7160b8b8dc5e7130b89c7118b88e710c710630b8985e71b8" +
  "309c719c308e718e105e30de71de70b0b85c7098b84e708c7086305c70dc304e70ce7058b82e704c7046302e706e702c70260af0857c0a78853e" +
  "0a3c0a1e0b7c0b3ef0bae17ac2fa85fa1ae08d78c6be1a708d3c1a388d1e1a1c1a0e097884be1b78093c1b3c091e1b1e09be1bbe3ac09d70cebc" +
  "3a609d38ce9e3a309d1c3a189d0e3a0c3a0619708cbc3b7019388c9e3b38191c3b1c190e3b0e08bc19bc089e3bbc199e3b9ebd60deb8ef5e7a40" +
  "bd30de9c7a20bd18de8e7a10bd0c7a08bd067a0439609cb8ce5e7b6039309c9c7b30bd9c9c8e7b18390c7b0c39067b0618b88c5e39b8189c7bb8" +
  "399c188e7b9c398e7b8e085e18de39de7bde7940bcb0de5c7920bc98de4e7910bc8c7908bc867904790238b09c5c79b038989c4e7998bcce798c" +
  "38867986185c38dc184e79dc38ce79ce78a0bc58de2e7890bc4c7888bc467884788238589c2e78d8384c78cc384678c6182e386e78ee7850bc2c" +
  "7848bc2678447842382c786c382678667828bc167824782238167836057882be053c051e05be0d7086bc0d38869e0d1c0d0e04bc0dbc049e0d9e" +
  "1d608eb8c75e1d308e9c1d188e8e1d0c1d060cb8865e1db80c9c1d9c0c8e1d8e045e0cde1dde3d409eb0cf5c3d209e98cf4e3d109e8c3d089e86" +
  "3d043d021cb08e5c3db01c988e4e3d989ece3d8c1c863d860c5c1cdc0c4e3ddc1cce3dcebea0df58efaebe90df4cbe88df46be84be823ca09e58" +
  "cf2e7da03c909e4c7d90becc9e467d883c847d843c827d821c588e2e3cd81c4c7dd83ccc1c467dcc3cc67dc60c2e1c6e3cee7deebe50df2cbe48" +
  "df26be44be423c509e2c7cd03c489e267cc8be667cc43c427cc21c2c3c6c1c267cec3c667ce6be28df16be24be223c289e167c683c247c643c22" +
  "7c621c163c367c76be14be123c147c343c127c3202bc029e06b8835e069c068e025e06de0eb0875c0e98874e0e8c0e86065c0edc064e0ece1ea0" +
  "8f58c7ae1e908f4c1e888f461e841e820e58872e1ed88f6e1ecc0e461ec6062e0e6e1eee9f50cfac9f48cfa69f449f421e508f2c3ed09f6c8f26" +
  "3ec81e443ec41e423ec20e2c1e6c0e263eec1e663ee6dfa8efd6dfa4dfa29f28cf96bf689f24bf649f22bf621e288f163e681e247ee83e641e22" +
  "7ee43e627ee20e161e363e767ef6df94df929f14bf349f12bf321e143e341e127e743e327e72df8a9f0abf1a1e0a3e1a7e3a035c034e075883ae" +
  "074c0746032e076e0f5087ac0f4887a60f440f42072c0f6c07260f668fa8c7d68fa48fa20f2887961f688fb61f640f221f6207160f361f76cfd4" +
  "cfd28f949fb48f929fb20f141f340f123f741f323f72cfca8f8a9f9a0f0a1f1a3f3a03ac03a607a883d607a407a2039607b687d487d207940fb4" +
  "07920fb2c7ea";
const pdfWzor = (klaster: number, slowo: number) => parseInt(PDF_TAB.substr((klaster * 929 + slowo) * 4, 4), 16) + 0x10000;

/** Słowa korekcyjne Reeda-Solomona nad GF(929): wielomian generujący ∏ (x − 3^i), i = 1..k. */
function pdfKorekcja(dane: number[], k: number): number[] {
  let g = [1];
  for (let i = 1, a = 3; i <= k; i++, a = (a * 3) % 929) {
    const n = new Array<number>(g.length + 1).fill(0);
    g.forEach((c, j) => { n[j] = (n[j] - ((a * c) % 929) + 929) % 929; n[j + 1] = (n[j + 1] + c) % 929; });
    g = n;
  }
  const ec = new Array<number>(k).fill(0);
  for (const d of dane) {
    const t = (d + ec[k - 1]) % 929;
    for (let x = k - 1; x >= 0; x--) ec[x] = ((x > 0 ? ec[x - 1] : 0) + 929 - ((t * g[x]) % 929)) % 929;
  }
  return ec.reverse().map((x) => (x > 0 ? 929 - x : x));
}

/** Wiersze modułów PDF417 („1” = kreska; każdy wiersz: start, wskaźnik lewy, dane, wskaźnik prawy, stop) albo null,
 *  gdy treść się nie mieści. Kompakcja bajtowa (UTF-8), 6 kolumn danych, poziom korekcji 2 (8 słów). */
export function pdf417(text: string, poziom = 2): string[] | null {
  const bajty = [...new TextEncoder().encode(text)];
  if (!bajty.length) return null;
  const dane = [bajty.length % 6 === 0 ? 924 : 901];
  for (let i = 0; i < bajty.length; i += 6) {
    const kawalek = bajty.slice(i, i + 6);
    if (kawalek.length < 6) {
      dane.push(...kawalek);
      continue;
    }
    let v = kawalek.reduce((a, b) => a * 256 + b, 0); // 48 bitów — liczba całkowita w double bez strat
    const piec: number[] = [];
    for (let j = 0; j < 5; j++, v = Math.floor(v / 900)) piec.unshift(v % 900);
    dane.push(...piec);
  }
  const k = 2 ** (poziom + 1);
  let kol = 6, wiersze = 0, pad = 0;
  for (;;) {
    const razem = 1 + dane.length + k;
    pad = (kol - (razem % kol)) % kol;
    wiersze = (razem + pad) / kol;
    if (wiersze < 3 && kol > 1) kol--;
    else if (wiersze > 90 && kol < 30) kol++;
    else break;
  }
  if (wiersze > 90 || 1 + dane.length + pad > 928) return null;
  const slowa = [1 + dane.length + pad, ...dane, ...new Array<number>(pad).fill(900)];
  const wszystkie = [...slowa, ...pdfKorekcja(slowa, k)];
  const bin = (v: number, n: number) => v.toString(2).padStart(n, "0");
  const a = Math.floor((wiersze - 1) / 3), b = poziom * 3 + ((wiersze - 1) % 3), c = kol - 1;
  return Array.from({ length: wiersze }, (_, r) => {
    const kl = r % 3, baza = 30 * Math.floor(r / 3);
    const srodek = wszystkie.slice(r * kol, r * kol + kol).map((w) => bin(pdfWzor(kl, w), 17)).join("");
    return bin(0x1fea8, 17) + bin(pdfWzor(kl, baza + [a, b, c][kl]), 17) + srodek + bin(pdfWzor(kl, baza + [c, a, b][kl]), 17) + bin(0x3fa29, 18);
  });
}

// ---- QR ----

/** Wersje 1–6, korekcja M: [słowa korekcyjne na blok, długości bloków danych]. */
const QR_BLOCKS: Array<[number, number[]]> = [[10, [16]], [16, [28]], [26, [44]], [18, [32, 32]], [24, [43, 43]], [16, [27, 27, 27, 27]]];
/** Środki wzorców wyrównania (wersja 1 nie ma żadnego). */
const QR_ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++, x = x & 128 ? ((x << 1) ^ 0x11d) & 255 : x << 1) {
  EXP[i] = x;
  LOG[x] = i;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const gmul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** Reszta Reeda-Solomona: `n` słów korekcyjnych dla bloku danych. */
function rsRemainder(data: number[], n: number): number[] {
  let gen = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array<number>(gen.length + 1).fill(0);
    gen.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= gmul(c, EXP[i]); });
    gen = next;
  }
  const r = [...data, ...new Array<number>(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const c = r[i];
    if (c) gen.forEach((g, j) => (r[i + j] ^= gmul(g, c)));
  }
  return r.slice(data.length);
}

const MASKS: Array<(y: number, x: number) => boolean> = [
  (y, x) => (y + x) % 2 === 0,
  (y) => y % 2 === 0,
  (_y, x) => x % 3 === 0,
  (y, x) => (y + x) % 3 === 0,
  (y, x) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (y, x) => ((y * x) % 2) + ((y * x) % 3) === 0,
  (y, x) => (((y * x) % 2) + ((y * x) % 3)) % 2 === 0,
  (y, x) => (((y + x) % 2) + ((y * x) % 3)) % 2 === 0,
];

/** Kara za wygląd maski (reguły standardu: ciągi, bloki 2×2, wzorce podobne do znaczników, proporcja ciemnych). */
function penalty(m: number[][]): number {
  const n = m.length;
  let p = 0, dark = 0;
  const lines: number[][] = [];
  for (let i = 0; i < n; i++) {
    lines.push(m[i]);
    lines.push(m.map((row) => row[i]));
  }
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) p += run - 2;
        run = 1;
      }
    }
    const s = `0000${line.join("")}0000`;
    for (let i = s.indexOf("1011101"); i >= 0; i = s.indexOf("1011101", i + 1))
      if (s.slice(i - 4, i) === "0000" || s.slice(i + 7, i + 11) === "0000") p += 40;
  }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      dark += m[y][x];
      if (y < n - 1 && x < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
  return p + 10 * (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1);
}

/** Macierz QR (wiersze 0/1, bez marginesu) albo null, gdy treść nie mieści się w wersji 6. */
export function qr(text: string): number[][] | null {
  const numeric = /^\d+$/.test(text);
  const bytes = numeric ? [] : [...new TextEncoder().encode(text)];
  const bits: number[] = [];
  const put = (v: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  if (numeric) {
    put(0b0001, 4);
    put(text.length, 10);
    for (let i = 0; i < text.length; i += 3) {
      const g = text.slice(i, i + 3);
      put(Number(g), g.length * 3 + 1);
    }
  } else {
    put(0b0100, 4);
    put(bytes.length, 8);
    bytes.forEach((b) => put(b, 8));
  }
  const version = QR_BLOCKS.findIndex(([, blocks]) => bits.length <= blocks.reduce((a, b) => a + b, 0) * 8) + 1;
  if (!version) return null;
  const [ec, blocks] = QR_BLOCKS[version - 1];
  const capacity = blocks.reduce((a, b) => a + b, 0) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < capacity / 8; pad ^= 0xec ^ 0x11) data.push(pad);

  // Bloki: dane i korekcja, potem przeplot słów między blokami.
  const split: number[][] = [];
  blocks.reduce((at, len) => (split.push(data.slice(at, at + len)), at + len), 0);
  const ecs = split.map((b) => rsRemainder(b, ec));
  const words: number[] = [];
  for (let i = 0; i < Math.max(...blocks); i++) split.forEach((b) => i < b.length && words.push(b[i]));
  for (let i = 0; i < ec; i++) ecs.forEach((b) => words.push(b[i]));

  const size = 17 + 4 * version;
  const m = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, v: number) => { m[y][x] = v; fn[y][x] = true; };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 ? 0 : 1);
    set(i, 6, i % 2 ? 0 : 1);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4 ? 1 : 0);
      }
  const al = QR_ALIGN[version - 1];
  for (const cy of al)
    for (const cx of al) {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === al[al.length - 1]) || (cy === 6 && cx === al[al.length - 1])) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 0 : 1);
    }
  const format = (mask: number, apply: (x: number, y: number, v: number) => void) => {
    const d = (0b00 << 3) | mask; // poziom M = 00
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const f = ((d << 10) | r) ^ 0x5412;
    const bit = (i: number) => (f >>> i) & 1;
    for (let i = 0; i <= 5; i++) apply(8, i, bit(i));
    apply(8, 7, bit(6));
    apply(8, 8, bit(7));
    apply(7, 8, bit(8));
    for (let i = 9; i < 15; i++) apply(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) apply(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) apply(8, size - 15 + i, bit(i));
    apply(8, size - 8, 1);
  };
  format(0, set); // rezerwacja pól formatu

  // Dane zygzakiem od prawego dolnego rogu, parami kolumn (z pominięciem kolumny wzorca taktującego).
  const stream = words.flatMap((w) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (w >>> i) & 1));
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++)
      for (let j = 0; j < 2; j++) {
        const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - v : v;
        if (!fn[y][x]) m[y][x] = k < stream.length ? stream[k++] : 0;
      }
  }

  let best: number[][] | null = null, bestP = Infinity;
  MASKS.forEach((mask, i) => {
    const c = m.map((row, y) => row.map((v, x) => (fn[y][x] ? v : v ^ (mask(y, x) ? 1 : 0))));
    format(i, (x, y, v) => (c[y][x] = v));
    const p = penalty(c);
    if (p < bestP) [best, bestP] = [c, p];
  });
  return best;
}
