// Sign atlas layout shared by the world generator (UVs) and the texture painter (canvas cells).
// Every sign has English text plus its Malayalam equivalent. The painter only draws the Malayalam
// line when a Malayalam font really loaded, so we never show garbled or fake words.
export const ATLAS = { w: 2048, h: 1024, cols: 4, rows: 8 };

// style: board colours  [background, text, accent]
export const SIGNS = [
  { id: 'police', en: 'POLICE STATION', ml: 'പോലീസ് സ്റ്റേഷൻ', style: ['#c4161c', '#ffffff', '#1d3f8f'], emblem: true },
  { id: 'tea', en: 'TEA SHOP', ml: 'ചായക്കട', style: ['#2f6b3a', '#fff1b0', '#f2b84b'] },
  { id: 'hotel', en: 'HOTEL', ml: 'ഹോട്ടൽ', style: ['#8a1c1c', '#ffe7a0', '#f2b84b'] },
  { id: 'grocery', en: 'GROCERY STORE', ml: 'പലചരക്ക് കട', style: ['#1f5f8b', '#ffffff', '#ffd54a'] },
  { id: 'medical', en: 'MEDICAL STORE', ml: 'മെഡിക്കൽ സ്റ്റോർ', style: ['#ffffff', '#12703a', '#12703a'] },
  { id: 'bakery', en: 'BAKERY', ml: 'ബേക്കറി', style: ['#f4b942', '#5a1f10', '#b3261e'] },
  { id: 'textiles', en: 'TEXTILES', ml: 'ടെക്സ്റ്റൈൽസ്', style: ['#6a1b6f', '#ffffff', '#ffd54a'] },
  { id: 'jewellery', en: 'JEWELLERY', ml: 'ജ്വല്ലറി', style: ['#1b1b1b', '#ffd54a', '#ffd54a'] },
  { id: 'vegetable', en: 'VEGETABLES', ml: 'പച്ചക്കറി', style: ['#3c8d2f', '#ffffff', '#ffeb3b'] },
  { id: 'busstop', en: 'BUS STOP', ml: 'ബസ് സ്റ്റോപ്പ്', style: ['#1d4e9e', '#ffffff', '#ffd54a'] },
  { id: 'ksrtc', en: 'KSRTC BUS STAND', ml: 'കെ.എസ്.ആർ.ടി.സി', style: ['#b3141b', '#fff3c4', '#fff3c4'] },
  { id: 'welcome', en: 'WELCOME TO KOLLAM', ml: 'സ്വാഗതം', style: ['#0d5c3e', '#ffffff', '#ffd54a'] },
  { id: 'beach', en: 'BEACH ROAD', ml: 'ബീച്ച് റോഡ്', style: ['#0d6b3b', '#ffffff', '#ffffff'] },
  { id: 'railway', en: 'RAILWAY STATION', ml: 'റെയിൽവേ സ്റ്റേഷൻ', style: ['#0d6b3b', '#ffffff', '#ffffff'] },
  { id: 'market', en: 'MARKET', ml: 'ചന്ത', style: ['#0d6b3b', '#ffffff', '#ffffff'] },
  { id: 'temple', en: 'TEMPLE ROAD', ml: 'ക്ഷേത്രം', style: ['#0d6b3b', '#ffffff', '#ffffff'] },
  { id: 'stationery', en: 'STATIONERY', ml: 'സ്റ്റേഷനറി', style: ['#e8f1ff', '#12418f', '#12418f'] },
  { id: 'mobiles', en: 'MOBILES', ml: 'മൊബൈൽസ്', style: ['#101820', '#4fd1ff', '#4fd1ff'] },
  { id: 'fruits', en: 'FRUITS & JUICE', ml: 'ഫ്രൂട്ട്സ്', style: ['#ef6c00', '#ffffff', '#ffeb3b'] },
  { id: 'kollam', en: 'KOLLAM  4 km', ml: 'കൊല്ലം', style: ['#0d6b3b', '#ffffff', '#ffffff'] },
  { id: 'lighthouse', en: 'LIGHTHOUSE LANE', ml: 'ലൈറ്റ് ഹൗസ്', style: ['#0d6b3b', '#ffffff', '#ffffff'] },
  { id: 'speed30', en: '30', ml: '', style: ['#ffffff', '#101010', '#d32020'], round: true },
  { id: 'slow', en: 'SLOW', ml: '', style: ['#ffd23f', '#101010', '#101010'] },
  { id: 'parking', en: 'POLICE PARKING', ml: '', style: ['#1d3f8f', '#ffffff', '#ffffff'] }
];

export function signIndex(id) {
  const i = SIGNS.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i;
}

// UV rectangle [u0, v0, u1, v1] for a sign id (round signs use the centred square of the cell).
export function signUV(id) {
  const i = signIndex(id), col = i % ATLAS.cols, row = Math.floor(i / ATLAS.cols);
  let u0 = col / ATLAS.cols, u1 = (col + 1) / ATLAS.cols;
  const v1 = 1 - row / ATLAS.rows, v0 = 1 - (row + 1) / ATLAS.rows;
  if (SIGNS[i].round) { const q = (u1 - u0) * 0.375; u0 += q; u1 -= q; }
  const padU = 0.0015, padV = 0.002;
  return [u0 + padU, v0 + padV, u1 - padU, v1 - padV];
}
