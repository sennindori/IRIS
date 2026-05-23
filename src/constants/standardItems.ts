export const STANDARD_ITEMS = [
  "TV 天然水2L",
  "TV 天然水ラベルレス2L",
  "コカコーラ いろはす2L",
  "キリン 自然が磨いた天然水2L",
  "サントリー 天然水南アルプス2L",
  "TV 炭酸水1L",
  "TV 炭酸水ラベルレス1L",
  "TV 炭酸水レモン1L",
  "TV 炭酸水グレープフルーツ1L",
  "TV 麦茶2L",
  "TV 緑茶2L",
  "TV 濃い緑茶2L",
  "TV ジャスミン茶2L",
  "TV 烏龍茶2L",
  "TV オーガニック緑茶2L",
  "伊藤園 健康ミネラルむぎ茶2L",
  "伊藤園 おーいお茶2L",
  "伊藤園 おーいお茶濃い茶2L",
  "伊藤園 おーいお茶ほうじ茶2L",
  "伊藤園 おーいお茶玄米茶2L",
  "コカコーラ やかんの麦茶2L",
  "コカコーラ 綾鷹2L",
  "コカコーラ 綾鷹濃い緑茶2L",
  "コカコーラ 綾鷹ミネラル緑茶2L",
  "コカコーラ 綾鷹黒豆ほうじ茶2L",
  "コカコーラ 爽健美茶2L",
  "キリン 生茶2L",
  "アサヒ 十六茶2L",
  "サントリー 烏龍茶2L",
  "サントリー 伊右衛門2L",
  "サントリー 伊右衛門濃い味2L",
  "サントリー やさしい麦茶2L",
  "サントリー 香ばし麦茶2L",
].map((item, index) => {
  const spaceMatch = item.match(/[\s　]/);
  const maker = spaceMatch && spaceMatch.index !== undefined ? item.substring(0, spaceMatch.index).trim() : "Other";
  const name = spaceMatch && spaceMatch.index !== undefined ? item.substring(spaceMatch.index + 1).trim() : item;
  return {
    id: `std-${index}`,
    maker,
    name
  };
});
