export interface DefaultCatalogItem {
  itemCode: string;
  description: string;
  category: string;
  uom: string;
  defaultQty: number;
  batchNo: string;
}

export const DEFAULT_WAREHOUSE_CATEGORY_NAMES: string[] = [
  "BEVERAGE",
  "CANNED,BOTTLED & PACKED PRODUCTS",
  "DAIRY PRODUCTS",
  "DESSERT",
  "GRAINS & FLOUR PRODUCTS",
  "MEAT PRODUCTS",
  "OILS",
  "PACKAGING",
  "POULTRY PRODUCTS",
  "PROCESSED/SAUCES",
  "SEAFOODS",
  "SPICES & SEASONING",
  "VEGETABLE",
  "PROCESSED",
  "SUPPLIES",
  "JANITORIALS",
  "OFFICE SUPPLIES",
  "WARES"
];

export const DEFAULT_STOCK_CATALOG: DefaultCatalogItem[] = [
  {
    "itemCode": "01-0201",
    "description": "7-Up 1.5L 12Btls/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0204",
    "description": "7-Up 2L",
    "category": "BEVERAGE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0101",
    "description": "7-Up Regular Sleek 330Ml 24 Cans/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0109",
    "description": "7-Up Zero Sugar Sleek 320 ml 24 cans/case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0806",
    "description": "Calamansi Puree 1kg/pack",
    "category": "BEVERAGE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0401",
    "description": "Carbonated Drink Co2 Tanks 20Lbs",
    "category": "BEVERAGE",
    "uom": "Tank",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0701",
    "description": "Corona Extra 355Ml 24Bottles/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0801",
    "description": "Hersey'S Chocolate Syrup (650G/24Btl/Cs",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0303",
    "description": "Iced Tea Lipton Lemon Postmix 5.28L/Bib",
    "category": "BEVERAGE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0803",
    "description": "Iced Tea Powder Lipton Lemon 320G/6pack/case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0702",
    "description": "Lemon Dou Honey Lemon 330Ml 12Cans/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0703",
    "description": "Lemon Dou Signature Lemon 330Ml 12Cans/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0802",
    "description": "Monin Strawberry Fruit Mix, 1Liter/4Bot/Cs",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0206",
    "description": "Mountain Dew 2L 9Bot/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0301",
    "description": "Mountain Dew Postmix 5.28L/Bib (5gal/BIB)=25KG",
    "category": "BEVERAGE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0203",
    "description": "Mountain Dew Regular 1.5L 12Bottles/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0102",
    "description": "Mountain Dew Sleek 330Ml 24 Cans/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0304",
    "description": "Mug Rootbeer Postmix 5.28L/BIB",
    "category": "BEVERAGE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0103",
    "description": "Mug Rootbeer Sleek 330Ml 24 Cans/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0105",
    "description": "Pepsi Black 330Ml 24 Cans/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0202",
    "description": "Pepsi Regular 1.5L 12Bottles/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0205",
    "description": "Pepsi Regular 2L",
    "category": "BEVERAGE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0302",
    "description": "Pepsi Regular Postmix 5.28L/Bib (5gal/BIB)=25KG",
    "category": "BEVERAGE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0104",
    "description": "Pepsi Regular Sleek 330Ml 24 Cans/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0108",
    "description": "Pepsi Zero Sugar Sleek 320 ml 24 cans/case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0804",
    "description": "Raspberry Syrup 750ML/12bottle/case",
    "category": "BEVERAGE",
    "uom": "Bot",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0106",
    "description": "Rite N' Lite Lemon Lime (250Ml) 24 Cans/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0107",
    "description": "Rite N' Lite Orange (250Ml) 24 Cans/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0606",
    "description": "RTD Starbucks Mocha 280Ml 12Bottles/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0704",
    "description": "San Miguel Beer Light 330Ml 24 Cans/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0601",
    "description": "Sola Lemon (24X473Ml)",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 4,
    "batchNo": ""
  },
  {
    "itemCode": "01-0602",
    "description": "Sola Raspberry (24X473Ml)",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 6,
    "batchNo": ""
  },
  {
    "itemCode": "01-0605",
    "description": "Sparkling Bundaberg Blood Orange 375Ml",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0604",
    "description": "Sparkling Bundaberg Ginger Beer 375Ml",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0603",
    "description": "Sparkling Bundaberg Peach 375Ml",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0805",
    "description": "Strawberry Syrup 2kg/9packs/case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0501",
    "description": "Viva Mineralized Water 500Ml 24Bot/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0503",
    "description": "Water Purified Premiere 500 ml/24 bot/cs",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "01-0502",
    "description": "Water Purified Wilkins 500Ml/24Bot/Case",
    "category": "BEVERAGE",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0101",
    "description": "Anchovies Fillet 56Gx24Can/Cs",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0102",
    "description": "Black Olives, Sansur (6X1.56Kg)",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Case",
    "defaultQty": 2,
    "batchNo": "10-31-28"
  },
  {
    "itemCode": "02-0201",
    "description": "Capers In Vinegar 720Grams/6Btls/Case",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0204",
    "description": "Jalapeno Peppers 330G 12 bottles/case",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Bot",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0307",
    "description": "Mushroom Shiitake Sunbest 284Gms 24 Cans/Case",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0306",
    "description": "Peanut (1Kg)",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Pack",
    "defaultQty": 4,
    "batchNo": "12/3/26"
  },
  {
    "itemCode": "02-0103",
    "description": "Pineapple Tidbits, Del Monte (24X822G)",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0104",
    "description": "Pineapple Tidbits, Dole (24X822G)",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Case",
    "defaultQty": 1,
    "batchNo": "1/7/29-1CS"
  },
  {
    "itemCode": "02-0301",
    "description": "Potato Wedges 10Cut So 2.27Kgx6/Cs",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0302",
    "description": "Potato Wedges Farm Frites Skin On 2Kg 6Pck/Cs",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0303",
    "description": "Potato Wedges Kingdom 500G",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0304",
    "description": "Potato Wedges Lamb Weston 1Kg",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0305",
    "description": "Potato Wedges Seasoned Skin On 2.2Kg/Pck",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0203",
    "description": "SB Spanish Sardines Reg Corn 230 g 24 bt/case",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0202",
    "description": "Sundried Tomatoes (12Btl/Case, 300G/Btl)",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "02-0311",
    "description": "Tokai Crabstick 250g/pack, 40 pcks/box, 10 kgs/box",
    "category": "CANNED,BOTTLED & PACKED PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0201",
    "description": "Anchorextrayieldcream-12X1Case",
    "category": "DAIRY PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0202",
    "description": "Butter Garlic 500G/Pack",
    "category": "DAIRY PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0203",
    "description": "Butter Unsalted , Anchor (40X227G)",
    "category": "DAIRY PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0111",
    "description": "Cheese Cheddar Sliced, President 20 slices 20 packs/case",
    "category": "DAIRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0101",
    "description": "Cheese Mozzarella 10Kg 2Bar/Case",
    "category": "DAIRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0102",
    "description": "Cheese Ricotta Fiordimaso 250G/9Tub/Case",
    "category": "DAIRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0205",
    "description": "Cheese Squeeze Magnolia PLN 220g 24pck/cs",
    "category": "DAIRY PRODUCTS",
    "uom": "Pack",
    "defaultQty": 48,
    "batchNo": "1/27/27"
  },
  {
    "itemCode": "03-0204",
    "description": "Cheese Squeeze Purefoods 235Gms 24Packs/Case",
    "category": "DAIRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0103",
    "description": "Feta, Arla (1X4Kg)",
    "category": "DAIRY PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0122",
    "description": "Cheese Feta Arla 200 g /6tubs/case",
    "category": "DAIRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0121",
    "description": "Feta, Arla Apetina in brine 4x1 kg",
    "category": "DAIRY PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0104",
    "description": "Mainlandvintagecheese (24X250G)",
    "category": "DAIRY PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0108",
    "description": "Mozzarella Anchor Shredded Extra Stretch 2Kg/6Pck/Cs",
    "category": "DAIRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0107",
    "description": "Mozzarella Jersey 2.3Kg/6Block / Case",
    "category": "DAIRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0207",
    "description": "Nestle Sour Cream 240G/24 pack/Case",
    "category": "DAIRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0206",
    "description": "Magnolia Cream Bar Cheese 225/48bar/Case",
    "category": "DAIRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0105",
    "description": "Parmesan Block Anchor (1X20Kg)",
    "category": "DAIRY PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "03-0106",
    "description": "Parmesan Grated Milano 2Kg/12Packs/Case",
    "category": "DAIRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0301",
    "description": "Crispy Pearl Dark 67.5G",
    "category": "DESSERT",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0302",
    "description": "Hazelnut Praline Paste 100G/Pck",
    "category": "DESSERT",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0103",
    "description": "Ice Cream, Chunky Cheese 237Ml/12Can/Cs",
    "category": "DESSERT",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0101",
    "description": "Ice Cream, Coffee Caramel 237Ml /12Can/Cs",
    "category": "DESSERT",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0102",
    "description": "Ice Cream, Cookies & Cream 237Ml/12Can/Cs",
    "category": "DESSERT",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0104",
    "description": "Ice Cream, Creamy Avocado 237Ml/12Can/Cs",
    "category": "DESSERT",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0105",
    "description": "Ice Cream, Dark Chocolate 237Ml/12Cans/Case",
    "category": "DESSERT",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0201",
    "description": "Ice Cream, Dark Chocolate, 3.8L/Gallon",
    "category": "DESSERT",
    "uom": "Gal",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0106",
    "description": "Ice Cream, Mocha Almond Fudge 237Ml /12Can/Cs",
    "category": "DESSERT",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0107",
    "description": "Ice Cream, Nutty Pistachio 237Ml/12Cans/Case",
    "category": "DESSERT",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0108",
    "description": "Ice Cream, Strawberry Fields 237Ml/12Cans/Case",
    "category": "DESSERT",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0109",
    "description": "Ice Cream, Vanilla Bean 237Ml/12Cans/Case",
    "category": "DESSERT",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0202",
    "description": "Ice Cream, Vanilla Non Fat Frozen Yogurt 3.8L/Gal",
    "category": "DESSERT",
    "uom": "Gal",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0303",
    "description": "Lemon Tart, Frozen 9Pcs/Pck",
    "category": "DESSERT",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0304",
    "description": "Mini Marshmallow - White, 340Grams/8Pck/Cs",
    "category": "DESSERT",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "04-0305",
    "description": "Pastries Ny Cheesecake 9Pcs/Pck",
    "category": "DESSERT",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0101",
    "description": "Baguette Bread",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0301",
    "description": "Coating Mix (1.5Kg) (8packs/CASE)",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pack",
    "defaultQty": 8,
    "batchNo": ""
  },
  {
    "itemCode": "05-0204",
    "description": "Cornmeal (1Kg)",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pack",
    "defaultQty": 2,
    "batchNo": ""
  },
  {
    "itemCode": "05-0205",
    "description": "Cornstarch Julu 1Kg 25Pack/Sack",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pack",
    "defaultQty": 1,
    "batchNo": "12/8/26"
  },
  {
    "itemCode": "05-0206",
    "description": "Cornstarch, Ram",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0209",
    "description": "Flour, Sun Moon Star",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0102",
    "description": "Hotdog Buns",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0203",
    "description": "Instant Yeast, Mauripan (20 X 500G)",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pack",
    "defaultQty": 5,
    "batchNo": "4-25-28"
  },
  {
    "itemCode": "05-0403",
    "description": "Macaroni, Elbow Del Monte 1Kg 10Pack/Case",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0411",
    "description": "Macaroni, Elbow Royal Premium 400g 30 packs/case",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pack",
    "defaultQty": 41,
    "batchNo": ""
  },
  {
    "itemCode": "05-0412",
    "description": "Macaroni, Royal Elbow 1kg.",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0413",
    "description": "Macaroni, Elbow Royal 200G",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0405",
    "description": "Pasta Spaghetti Royal, 400 grams",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0421",
    "description": "Penne Rigate, Royal premium 500 g 20 packs/case",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0208",
    "description": "Pizza Flour, Morning Star 25 kg/bag",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Bag",
    "defaultQty": 12,
    "batchNo": "11/30/26"
  },
  {
    "itemCode": "05-0202",
    "description": "Pizza Flour, Yellow Cab (25Kg)",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0501",
    "description": "Rice, Sinandomeng (2kg/pck)",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0207",
    "description": "Soft Flour Morning Star 25kg/bag",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Bag",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0201",
    "description": "Soft Flour, Golden (25Kg)",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0404",
    "description": "Spaghetti 1kg 12packs/case",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Case",
    "defaultQty": 3,
    "batchNo": ""
  },
  {
    "itemCode": "05-0401",
    "description": "Spaghetti, Ideal 1Kg 12Packs/Case",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0402",
    "description": "Spaghetti, Royal 900 Grams",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0103",
    "description": "YC Breads, Frozen, Brioche Buns 6 pcs/pack",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0302",
    "description": "YC- Premix, Chicken Breading Mix (1Kg/Pack)",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0441",
    "description": "Lasagna, Ideal Gourmet 454 gms 10 pcks/case",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "05-0431",
    "description": "Fettuccine, San Remo 500 g 20 packs/case",
    "category": "GRAINS & FLOUR PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0101",
    "description": "Bacon Cut End 1Kg/Pck",
    "category": "MEAT PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0102",
    "description": "Bacon Strips 400G/20Pck/Cs",
    "category": "MEAT PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0501",
    "description": "Beef Frank Sausage 1Kg (14Pcs/Pack)",
    "category": "MEAT PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0502",
    "description": "Beef Italian Sausage (200Mm X 250Mm X85 Microns)",
    "category": "MEAT PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0401",
    "description": "Beef Pepperoni (Foodspere) 1Kg/Pck",
    "category": "MEAT PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0402",
    "description": "Beef Pepperoni (Virginia) 1 Kg/Pck",
    "category": "MEAT PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0201",
    "description": "Ground Beef, Foodsphere 1Kg/Pack",
    "category": "MEAT PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0301",
    "description": "Ham, Chicken Sliced Cdo 250Grms/32Pck/Cs",
    "category": "MEAT PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Ham, Chicken Virginia 250 G x 32",
    "category": "MEAT PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0302",
    "description": "Ham, Cooked 200G/Pack",
    "category": "MEAT PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0303",
    "description": "Ham, Sweet Good Morning 1Kg/Pack",
    "category": "MEAT PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0403",
    "description": "No Pork Pepperoni Dry, DM 1kg/pck, 10 pcks/cs",
    "category": "MEAT PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0103",
    "description": "Virginia Honey-Cured Bacon 1Kg (10pcks/case)",
    "category": "MEAT PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0202",
    "description": "YC Beef Meatballs 700G",
    "category": "MEAT PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "06-0203",
    "description": "YC Beef, Ground, Cooked 1 kg/pack",
    "category": "MEAT PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "07-0202",
    "description": "Olive Oil (3X5L) - Pomace",
    "category": "OILS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "07-0204",
    "description": "Olive Oil Pomace 5L/4 bottles/case (SANSUR)",
    "category": "OILS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "07-0201",
    "description": "Olive Oil, Blended 3Liters/6Containers Cse",
    "category": "OILS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "07-0203",
    "description": "Olive Oil, Olivasol - Pomace 5L/4 Bottles/Case",
    "category": "OILS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": "3/30/28"
  },
  {
    "itemCode": "07-0102",
    "description": "Palm Olein (16Kg/Tin)",
    "category": "OILS",
    "uom": "Tin",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "07-0101",
    "description": "Palm Olein (17Liter/Tin) (FRYMAX)",
    "category": "OILS",
    "uom": "Tin",
    "defaultQty": 8,
    "batchNo": "7/29/27"
  },
  {
    "itemCode": "07-0301",
    "description": "Truffle Oil, Black In Extra Virgin Oil 250Ml/12Btl/Case",
    "category": "OILS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0401",
    "description": "All Purpose Wrapper Grease Proof Plain ( 8\" X 11\") 1000Pcs",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Alum Foil 300G With Lid 125Pcs/Pack (Large) LID ONLY",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 6,
    "batchNo": ""
  },
  {
    "itemCode": "13-0403",
    "description": "Alum Foil 300G With Lid 125Pcs/Pack (Large) TUB ONLY",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 3,
    "batchNo": ""
  },
  {
    "itemCode": "13-0402",
    "description": "Alum Tray 100Pcs/Pck",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Aluminum Foil Tray W/Lid. 6Inx4.7X2In, 125Pcs/8Pck/Cs (Regular) LID ONLY",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 7,
    "batchNo": ""
  },
  {
    "itemCode": "13-0404",
    "description": "Aluminum Foil Tray W/Lid. 6Inx4.7X2In, 125Pcs/8Pck/Cs (Regular)TUB ONLY",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 2,
    "batchNo": ""
  },
  {
    "itemCode": "13-0251",
    "description": "Aluminum tray, 600 ml 125 pc/8packs/case",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0301",
    "description": "Cap-Black 3Mm,240Pcs/Pck",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0236",
    "description": "Cater Tray with lid 3200ml white plastic",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0242",
    "description": "Chicken Wings Liner with Print, 8.25 in x 8.25 in 500 pcs per ream",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 2,
    "batchNo": ""
  },
  {
    "itemCode": "13-0418",
    "description": "Chili Oil Sticker Label 8.27 x 11.69 in (12pcs/sheet, 10 shts / pck)",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0201",
    "description": "Clamshell Sht-061, X3.3X3/4,100Pcs/Pck",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0202",
    "description": "Corrugated Sleeve B-Flute 25Pc/Pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0203",
    "description": "Cup Sauce Set 2.5 Oz Clear 100Pcs/Pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0241",
    "description": "Flaglets, 100 pcs per pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0243",
    "description": "Flaglets, 100 pcs/ pack WW",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0419",
    "description": "Hot Honey Sticker Label 13.78 x 16.19 in (10pcs/sht, 10 shts/pck)",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0204",
    "description": "Hot Wings Liner (6 X 6 )",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0205",
    "description": "Hot Wing'S Tray (100Pcs/Pack )",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0206",
    "description": "Hotdog Clamshell Box, 9-1/16'' X 9-7/16'' Plain - Cb#15 (50Pcs/Pack)",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 3,
    "batchNo": ""
  },
  {
    "itemCode": "13-0233",
    "description": "Insert Tray 50 pcs/pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0405",
    "description": "Laminated Board Cover 100Pcs/Pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0207",
    "description": "Noodle Box#2 (25Pcs/Pck) Unprinted",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0210",
    "description": "Noodle Box#2 Divider 250Pc/Pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0208",
    "description": "Noodle Box#4 (25Pcs/Pck) Unprinted",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0211",
    "description": "Noodle Box#4 Divider 50 Pcs X 1 Pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0209",
    "description": "Noodle Box#6 (25Pc/Pk) New",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0406",
    "description": "Nopi Tape - Logo (12Pcs)",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0408",
    "description": "Paper Bag #20 (50Pc/20Bun/Cs)",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0407",
    "description": "Paper Bag#12(100Pc/Bunx20)New",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0317",
    "description": "Paper Cup (1000Pcs/Cs) 80Z",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0323",
    "description": "Paper Cup Customized 12 oz - 50 pcs/20 packs/case",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 2,
    "batchNo": ""
  },
  {
    "itemCode": "13-0321",
    "description": "Paper Cup Customized 16 oz - 50 pcs/20 packs/case",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0302",
    "description": "Paper Cup For Soda 16Oz 50Pc/20Pck/Cs",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0303",
    "description": "Paper Plates Wht .(9'')(1000Pcs)",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0304",
    "description": "Paper Straw White Coated 100Pcs/Box",
    "category": "PACKAGING",
    "uom": "Box",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0212",
    "description": "Pasta Portioning Bag (100Pcs)",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 25,
    "batchNo": ""
  },
  {
    "itemCode": "13-0147",
    "description": "Pizza Bar Box 50 pc/pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0132",
    "description": "Pizza Box 11\" B-flute 50 pcs/Bundle - new",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0148",
    "description": "Pizza Bar Sleeve 50 pc/pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0145",
    "description": "Pizza Box 11\", Comic Fantastic Four 50 pcs/bundle",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0146",
    "description": "Pizza Box 11\", Pop-art Fantastic Four 50 pcs/bundle",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0102",
    "description": "Pizza Box 12'' 50Pcs/Bundle (E-Flute)New",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0103",
    "description": "Pizza Box 15'' 50Pcs/Bundle (E-Flute)",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0133",
    "description": "Pizza Box 15\" B-flute 50 pcs/Bundle - new",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0143",
    "description": "Pizza Box 15\" B-flute, Square DP3",
    "category": "PACKAGING",
    "uom": "Box",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0104",
    "description": "Pizza Box 18'' 50Pcs/Bundle (E-Flute)",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0134",
    "description": "Pizza Box 18\" B-flute 50 pcs/Bundle - new",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0101",
    "description": "Pizza Box 9'' 50Pcs/Bundle (E-Flute)",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0131",
    "description": "Pizza Box 9\" B-flute 50 pcs/Bundle - new",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0141",
    "description": "Pizza Box 9\" E-flute, Rectangular DP3 Red",
    "category": "PACKAGING",
    "uom": "Box",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0142",
    "description": "Pizza Box 9\" E-flute, Rectangular DP3 Yellow",
    "category": "PACKAGING",
    "uom": "Box",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0135",
    "description": "Pizza Box Rectangular 9\" E-flute 50 pcs/bundle",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 11,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Pizza Box Rectangular 16x6\" E-flute WT/CM/ 50 pcs/bundle",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0137",
    "description": "Pizza Box Square 11\" B-flute 50 pcs/bundle",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 12,
    "batchNo": ""
  },
  {
    "itemCode": "13-0138",
    "description": "Pizza Box Square 15\" B-flute 50 pcs/bundle",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 1,
    "batchNo": ""
  },
  {
    "itemCode": "13-0139",
    "description": "Pizza Box Square 18\" B-flute 50 pcs/bundle",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 2,
    "batchNo": ""
  },
  {
    "itemCode": "13-0136",
    "description": "Pizza Box Square 9\" E-flute 50 pcs/bundle",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0144",
    "description": "Pizza Box square 13\" 50 pc/bun",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0111",
    "description": "Pizza Liner 11.5\" (500 pcs/ream)",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0107",
    "description": "Pizza Liner 12'' (500Pcs/Ream)",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0108",
    "description": "Pizza Liner 15'' (500Pcs/Ream)",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0109",
    "description": "Pizza Liner 18'' (500Pcs/Ream)",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0106",
    "description": "Pizza Liner 9'' (500Pcs/Ream)",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0112",
    "description": "Pizza Liner 9.5\" x 9.5\" 500 pcs/ream",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0153",
    "description": "Pizza Liner With Print 10x5 In 500 pcs/ream",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 2,
    "batchNo": ""
  },
  {
    "itemCode": "13-0154",
    "description": "Pizza Liner With Print 11.5 x 11.5 in 500 pcs/ream",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 1,
    "batchNo": ""
  },
  {
    "itemCode": "13-0157",
    "description": "Pizza Liner with print 13.5\" x 13.5\" 500 pcs/ream",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0155",
    "description": "Pizza Liner with print 15.5\" x 15.5\" 500 pcs/ream",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 1,
    "batchNo": ""
  },
  {
    "itemCode": "13-0156",
    "description": "Pizza Liner with print 18.25\" x 18.25\" 500 pcs/ream",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0151",
    "description": "Pizza Liner With Print 9.5 x 9.5 In 500 pcs/ream",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 1,
    "batchNo": ""
  },
  {
    "itemCode": "13-0152",
    "description": "Pizza Liner, Half Moon 10\"x5\" 500 pcs/ream",
    "category": "PACKAGING",
    "uom": "Ream",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0231",
    "description": "Plastic Container 3-Compartment with Lid 25 pc x 6 packs/case",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 18,
    "batchNo": ""
  },
  {
    "itemCode": "13-0235",
    "description": "Plastic Container w/ lid 2-div re2D clear 50 sets/pack 3 packs/case",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0305",
    "description": "Plastic Cup Carrier-Double 12X12X001 Hd Transparent, 1000Pcs/Pck",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0306",
    "description": "Plastic Cup Carrier-Single, 7 X 13 X002 Pe, 500Pcs/Pck",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0307",
    "description": "Plastic Cup With Lids (1.0 Oz X 200Pcs)",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0308",
    "description": "Plastic Cups (1.5Ozx100Pcs)",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0213",
    "description": "Plastic Hinged Cup 100Ml 100Pcs/Pck 10Pck/Case",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0214",
    "description": "Plastic Hinged Cup 2Oz 100 Pcs X 10 Pck/Cs(local)",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 6,
    "batchNo": ""
  },
  {
    "itemCode": "13-0215",
    "description": "Plastic Hinged Cup 4Oz 100Pcs X 10Pck/Cs",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0309",
    "description": "Plastic Lids (1.5Ozx100Pcs)",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0310",
    "description": "Plastic Lids For Soda 16Oz 100Pc/10Pck/Bun",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0311",
    "description": "Plastic Pp Edge Fork, Black (25pcs, 100pck/case)",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0312",
    "description": "Plastic Pp Edge Spoon 25Pc 100Pck/Cs",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0314",
    "description": "Plastic Pp Knife Black (50Pcs, 50Pck/Case)",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0110",
    "description": "Plastic Pp Pizza Cutter (10Pcs, 100Pck/Case)",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0313",
    "description": "Plastic Spoon 25 Pcs/60Packs/1Case",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Plastic tub w/ lid Black rect 750 50 pcs/10pack/case LID ONLY",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 36,
    "batchNo": ""
  },
  {
    "itemCode": "13-0237",
    "description": "Plastic tub w/ lid Black rect 750 50 pcs/10pack/case TUB ONLY",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 10,
    "batchNo": ""
  },
  {
    "itemCode": "13-0239",
    "description": "Plastic tub w/ lid Black SQ 500ml 25pcs/12packs/case",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 7,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Plastic tub w/ lid Black SQ 500ml 25pcs/12packs/case LID ONLY",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0238",
    "description": "Plastic tub w/ lid Black SQ 1000ml, 25 pcs x 12 packs/case LID ONLY",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 1,
    "batchNo": ""
  },
  {
    "itemCode": "13-0238",
    "description": "Plastic tub w/ lid Black SQ 1000ml, 25 pcs x 12 packs/case",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 12,
    "batchNo": ""
  },
  {
    "itemCode": "13-0409",
    "description": "Plastic Twine",
    "category": "PACKAGING",
    "uom": "Roll",
    "defaultQty": 3,
    "batchNo": ""
  },
  {
    "itemCode": "13-0315",
    "description": "Round Bottle - Cfpet 27, 500Ml/ 120Pcs/Pck",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0316",
    "description": "Round Bottle - Cfpet 48, 1L/ 90Pcs/Pck",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0410",
    "description": "Sando Bag, Large(100Pcs/Pack)",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0411",
    "description": "Sando Bag, Medium(100Pcs/Pack)",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 4,
    "batchNo": ""
  },
  {
    "itemCode": "13-0412",
    "description": "Sando Bag, Tiny(100Pcs/Pack)",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 1,
    "batchNo": ""
  },
  {
    "itemCode": "13-0234",
    "description": "Sandwich Bagasse 450 ml 50 pcs/pack 10 packs/case",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0422",
    "description": "Satin sticker YC, Fantastic Four 100 pcs/pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0322",
    "description": "Sippy Lid - 90 mm 100 pcs/pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0232",
    "description": "Square Tub with Lid SQ 500 50 pcs x 10 packs/case",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0413",
    "description": "Sticker Label, 4.5Inches X 3Inches,72Pcs/Pck (4Pcs/Pad)",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0505",
    "description": "Sticker Label Friday 2.5x1.75\" 250pcs/roll",
    "category": "PACKAGING",
    "uom": "Roll",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0501",
    "description": "Sticker Label Monday 2.5x1.75\" 250pcs/roll",
    "category": "PACKAGING",
    "uom": "Roll",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0506",
    "description": "Sticker Label Saturday 2.5x1.75\" 250pcs/roll",
    "category": "PACKAGING",
    "uom": "Roll",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0507",
    "description": "Sticker Label Sunday 2.5x1.75\" 250pcs/roll",
    "category": "PACKAGING",
    "uom": "Roll",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0504",
    "description": "Sticker Label Thursday 2.5x1.75\" 250pcs/roll",
    "category": "PACKAGING",
    "uom": "Roll",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0502",
    "description": "Sticker Label Tuesday 2.5x1.75\" 250pcs/roll",
    "category": "PACKAGING",
    "uom": "Roll",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0503",
    "description": "Sticker Label Wednesday 2.5x1.75\" 250pcs/roll",
    "category": "PACKAGING",
    "uom": "Roll",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0414",
    "description": "Sticker, 4'' X 2'' Satin YC 100 Pcs/Bun",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0425",
    "description": "Satin Sticker YC 2x4 inch 200 pcs/roll",
    "category": "PACKAGING",
    "uom": "Roll",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0415",
    "description": "Table Napkin Brown, 200Shts/50Pck/Cs",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0420",
    "description": "The Works Sticker 8.5 x 11 in. 5 sheets per pack",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0421",
    "description": "Tomato Ketchup Sticker Label 10 pcs/sht, 10 shts/pck",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0149",
    "description": "Transit Box Corrugated 10 pcs.bundle",
    "category": "PACKAGING",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0416",
    "description": "Uni Cup - Lid(50 Pcs/Sleeve)",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0417",
    "description": "Uni Cup-Soup Cup-12Oz(25Pc/Pk)",
    "category": "PACKAGING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0355",
    "description": "Plastic Edge Fork Black PP OXO-BIO (25pcs, 100pck/case)",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0354",
    "description": "Plastic Pp Knife Black PP OXO-BIO (50Pcs, 50Pck/Case)",
    "category": "PACKAGING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0324",
    "description": "Pet Cylindrical Bottle 350ML 180pc/pack",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 145,
    "batchNo": ""
  },
  {
    "itemCode": "13-0325",
    "description": "Pet Round Bottle 1L 90pc/pack",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0326",
    "description": "Cap 38mm Clear 90pc/16pack/case",
    "category": "PACKAGING",
    "uom": "Pc",
    "defaultQty": 145,
    "batchNo": ""
  },
  {
    "itemCode": "08-0101",
    "description": "Chicken Leg Quarter Boneless Skin On 2Kg/Pack 6 Pack/Case",
    "category": "POULTRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "08-0301",
    "description": "Chicken Marinated Cut- Ups (8Pcs/Pack ; 9Pck/Set)",
    "category": "POULTRY PRODUCTS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "08-0201",
    "description": "Chicken Wings(15 Kg/Box)",
    "category": "POULTRY PRODUCTS",
    "uom": "Box",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "08-0401",
    "description": "Egg Fresh Medium 56 - 60Gms/Pc 30 Pcs/Tray",
    "category": "POULTRY PRODUCTS",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "08-0102",
    "description": "Frozen Fillet Thigh 2Kg/Pack 6Pack/Case",
    "category": "POULTRY PRODUCTS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0506",
    "description": "Balsamic Vinegar of Molinera (250 ml/12Pck/Case)",
    "category": "PROCESSED/SAUCES",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0101",
    "description": "Bbq Sauce ( 1 Kg/Pk X 12 Pk)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0201",
    "description": "Cccp Sauce (6Packsx2Kg)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0202",
    "description": "Cccp Sauce (8Packsx2Kg)",
    "category": "PROCESSED/SAUCES",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0203",
    "description": "CCCP Sauce 1 kg/12 pack/case",
    "category": "PROCESSED/SAUCES",
    "uom": "Case",
    "defaultQty": 3,
    "batchNo": "1/22/27"
  },
  {
    "itemCode": "09-0305",
    "description": "Garlic Ranch Dressing 500G/Pack",
    "category": "PROCESSED/SAUCES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0301",
    "description": "Garlic Ranch Dressing(1L)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0401",
    "description": "Hot Wing Sauce (.5Kg)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0303",
    "description": "Mayonnaise Lady's Choice 220 ml",
    "category": "PROCESSED/SAUCES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0302",
    "description": "Mayonnaise Lady's Choice 470 ml (12 pcs/case)",
    "category": "PROCESSED/SAUCES",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0703",
    "description": "Mustard Sachet 7G/200Pcs/Case",
    "category": "PROCESSED/SAUCES",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0304",
    "description": "Mayonnaise Lady's Choice 80 ml",
    "category": "PROCESSED/SAUCES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0501",
    "description": "Pizza Sauce (6Packsx2Kg)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0502",
    "description": "Pizza Sauce (8Packsx2Kg)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0505",
    "description": "Pure Series Activated Charcoal Powder (200g/pack)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0601",
    "description": "Spaghetti Sauce(8X2Kg)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0701",
    "description": "Spicy Brown Mustard - American Garden (12Oz/12Btls/Case)",
    "category": "PROCESSED/SAUCES",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0801",
    "description": "White Wine Sauce (2Kg/Pck),Fsi",
    "category": "PROCESSED/SAUCES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0802",
    "description": "Wws 1Kg/16Pck/Cs",
    "category": "PROCESSED/SAUCES",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0504",
    "description": "YC - Sauce, Pesto (250 G/pack)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0901",
    "description": "YC Sauce Gravy (1Kg/Pack)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0902",
    "description": "YC Sauce Gravy (500G/Pack)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0603",
    "description": "YC Sauce Meaty Spaghetti (1kg/pack)",
    "category": "PROCESSED/SAUCES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0602",
    "description": "YC Sauce, Marinara (1 kg/pack; 12 pck/case)",
    "category": "PROCESSED/SAUCES",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0503",
    "description": "YC Sauce, Pizza (1kg/pack; 12 pck/case)",
    "category": "PROCESSED/SAUCES",
    "uom": "Case",
    "defaultQty": 8,
    "batchNo": "1/5/27"
  },
  {
    "itemCode": "09-0702",
    "description": "Yellow Mustard Heinz 14oz 12btl/case",
    "category": "PROCESSED/SAUCES",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "09-0311",
    "description": "Mazza Black Truffle Cream Salsa Al Tartufo 6 x 500 grams",
    "category": "PROCESSED/SAUCES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "10-0102",
    "description": "Vannamei Shrimp(12Pk/Case)",
    "category": "SEAFOODS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "10-0101",
    "description": "Shrimp Fro.(Appro1Kg/Pack)",
    "category": "SEAFOODS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "10-0103",
    "description": "Shrimp Frozen Vannamei #26/30 1Kg/Pck X 10Pck/Case",
    "category": "SEAFOODS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0801",
    "description": "Black Pepper, Ground (1Kg)",
    "category": "SPICES & SEASONING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0805",
    "description": "Black Pepper, Ground Garing 500 gms 50 packs/sack",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0101",
    "description": "Catsup Sachet, YC (10Gx200)",
    "category": "SPICES & SEASONING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0201",
    "description": "Cayenne Ground 250/Pck",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0301",
    "description": "Cha Spice Mix 1/4 1.6-1.8G (50Pcs/152Packs/1Case)",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 4,
    "batchNo": "1/8/27"
  },
  {
    "itemCode": "11-0302",
    "description": "Cha Spice Mix 7Gms/50Pcs/71Packs/Case",
    "category": "SPICES & SEASONING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0202",
    "description": "Cumin ground, repacked (250 G/pack)",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0102",
    "description": "Heinz Tomato Ketchup 12x38oz",
    "category": "SPICES & SEASONING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0104",
    "description": "Heinz Tomato Ketchup 325g 24 pck/case",
    "category": "SPICES & SEASONING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0402",
    "description": "Hot Sauce Sachet (250X7G)",
    "category": "SPICES & SEASONING",
    "uom": "Case",
    "defaultQty": 2,
    "batchNo": ""
  },
  {
    "itemCode": "11-0401",
    "description": "Hot Sauce, YC (24X150Ml)",
    "category": "SPICES & SEASONING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0501",
    "description": "Iodized Salt 1Kg/Pck",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0502",
    "description": "Iodized Salt, Mc (1Kg/Pack)",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0601",
    "description": "ISD Half Batch (116.25G)",
    "category": "SPICES & SEASONING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0602",
    "description": "ISD Half Batch 114.5-118G/12Sct/10Pck/Bag",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 10,
    "batchNo": "5/30/27"
  },
  {
    "itemCode": "11-1002",
    "description": "Kimnori Korean Crispy Seaweed Original Flavor 40g 20 packs/case",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0711",
    "description": "McCormick Thyme Leaves Whole (14G/12packs/case)",
    "category": "SPICES & SEASONING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0701",
    "description": "Oregano, Whole (250G/Pack)",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0702",
    "description": "Oregano, Whole Repacked (150g/pack, 9 packs/case)",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": "12/5/26"
  },
  {
    "itemCode": "11-0806",
    "description": "Pepper Red Crushed, repacked (1kg/pack)",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": "2/10/27"
  },
  {
    "itemCode": "11-0802",
    "description": "Red Pepper Sachet(100Pcs/Pack)",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 10,
    "batchNo": ""
  },
  {
    "itemCode": "11-0803",
    "description": "Red Pepper, Crushed (500G)",
    "category": "SPICES & SEASONING",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0804",
    "description": "Red Pepper, Crushed Mccormick 500Gms/Pck",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-0901",
    "description": "Rock Sugar Honey 2Kg/8Pck/Cs",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": "1/8/27"
  },
  {
    "itemCode": "11-0503",
    "description": "Salt Iodized Master Chef 1Kg 15Pck/Cs",
    "category": "SPICES & SEASONING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "11-1001",
    "description": "Sriracha Dry Rub Powder 250G 10Packs/1Case",
    "category": "SPICES & SEASONING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": "2/26/27"
  },
  {
    "itemCode": "11-0404",
    "description": "YC Hot Sauce ABMARAC 150 ml 24bot/case",
    "category": "SPICES & SEASONING",
    "uom": "Bot",
    "defaultQty": 48,
    "batchNo": "6/24/28"
  },
  {
    "itemCode": "11-0403",
    "description": "YC Syrup, Hot Honey (1 kg/pack)",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": "12/14/26"
  },
  {
    "itemCode": "11-1101",
    "description": "YC Premix, Liquid Mix 285G/Pack:25Pck/Cs",
    "category": "SPICES & SEASONING",
    "uom": "Pack",
    "defaultQty": 50,
    "batchNo": ""
  },
  {
    "itemCode": "11-0103",
    "description": "Ketchup, tomato sachet del Monte 10g 200 pcs/case",
    "category": "SPICES & SEASONING",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": "11/7/26"
  },
  {
    "itemCode": "12-0101",
    "description": "Alfalfa ( 125 Grams/Pack )",
    "category": "VEGETABLE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0201",
    "description": "Arugula ( 250 Gram/Pack )",
    "category": "VEGETABLE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0301",
    "description": "Basil Fresh (100Gms/Pack)",
    "category": "VEGETABLE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0401",
    "description": "Bell Pepper - Green 1Kg; 7-11Cm Length, 5.5-9Cm Diameter",
    "category": "VEGETABLE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0402",
    "description": "Bell Pepper - Red (1Kg)",
    "category": "VEGETABLE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0501",
    "description": "Button Mushroom Fresh(1Kg)",
    "category": "VEGETABLE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0802",
    "description": "Cucumber 500G/pack",
    "category": "VEGETABLE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0601",
    "description": "Cut Romaine Lettuce 200G/Pack",
    "category": "VEGETABLE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0701",
    "description": "Garlic Peeled 1 Kg/ Pack",
    "category": "VEGETABLE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0801",
    "description": "Lime (125Gram/Pack)",
    "category": "VEGETABLE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0302",
    "description": "Mint leaves 50 Grams/pack",
    "category": "VEGETABLE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0901",
    "description": "Onion Red(1Kg) 5.5-7Cm Diameter",
    "category": "VEGETABLE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0502",
    "description": "Shiitake Mushroom Fresh (200G/Pk)",
    "category": "VEGETABLE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0903",
    "description": "Spring Onion(125Gram/Pack)",
    "category": "VEGETABLE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-1002",
    "description": "Tomato Cherry 200G",
    "category": "VEGETABLE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-1001",
    "description": "Tomato Fresh(1Kg) 6-7Cm/Pc",
    "category": "VEGETABLE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-1101",
    "description": "Wansuy(Cilantro) 125Gram/Pack",
    "category": "VEGETABLE",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "12-0902",
    "description": "White Onion(1Kg) 5.5-7Cm Diameter",
    "category": "VEGETABLE",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "CCCPS-C",
    "description": "CHARLIE CHAN CHICKEN PASTA SAUCE",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "CHA-S",
    "description": "CHICKEN ALFREDO SAUCE",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "MS-ONLINE",
    "description": "MARINARA SAUCE, REHEATED",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "HWS",
    "description": "HOT WINGS SAUCE",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "GBS",
    "description": "GARLIC BUTTER SAUCE",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "CCCP-CHX",
    "description": "CHARLIE CHAN CHICKEN, RAW",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "CCCP CHX-C",
    "description": "CHARLIE CHAN CHICKEN, COOKED",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "CHA CHX-C",
    "description": "CHICKEN ALFREDO CHICKEN, COOKED",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "BCP CHX",
    "description": "BARBECUE CHICKEN, MARINATED",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "CP",
    "description": "CHICKEN POPPERS, MARINATED",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "CW-M",
    "description": "CHICKEN WINGS, MARINATED",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "EW",
    "description": "EGG WASH",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "CWC",
    "description": "CHICKEN WINGS COATED",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "NUT",
    "description": "PEANUTS, BAKED",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "BF",
    "description": "GROUND BEEF, COOKED",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "MACARONI, COOKED",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "NF",
    "description": "PASTA, COOKED - FULL",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "NQ",
    "description": "PASTA, COOKED - QTR",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "CO",
    "description": "CHILI OIL",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "MBP70",
    "description": "MEATBALLS 70G",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "D9",
    "description": "DOUGH 9\"",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "D12",
    "description": "DOUGH 11\"",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "D15",
    "description": "DOUGH 15\"",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "D18",
    "description": "DOUGH 18\"- ORIG",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "HWN SL 18\"",
    "description": "HAWAIIAN SLICE 18\"",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "NYC SL 18\"",
    "description": "NY CLASSIC SLICE 18\"",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "DT18",
    "description": "Dough 18\" - Thins",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "RICE-C",
    "description": "RICE COOKED",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "MAC-CHZ",
    "description": "MAC & CHEESE",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "BFX",
    "description": "BEEF PRE-MIX",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "RAN",
    "description": "RANCH DIP",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Minced Onion",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Minced Onion",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "fettuccine-Cooked",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "CFS-M1",
    "category": "PROCESSED",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31021039",
    "description": "TRASHBAG BLK W/TIE(40ROLL/PAC)",
    "category": "SUPPLIES",
    "uom": "Roll",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31021040",
    "description": "TRASHBAGWHT W/TIE(20ROLL/PACK)",
    "category": "SUPPLIES",
    "uom": "Pack",
    "defaultQty": 1,
    "batchNo": ""
  },
  {
    "itemCode": "41061018",
    "description": "GLOVES TPE MEDIUM, 100PCS/20PCK/CASE",
    "category": "SUPPLIES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "41061019",
    "description": "GLOVES TPE LARGE, 100PCS/20PCK/CASE",
    "category": "SUPPLIES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "51021291",
    "description": "MOP HEAD, BLUE",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "51021292",
    "description": "MOP HEAD GREEN",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "51021293",
    "description": "MOP HEAD RED",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "51021303",
    "description": "MOP HANDLE, BLUE",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "51021304",
    "description": "MOP HANDLE, GREEN",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "51021302",
    "description": "MOP HANDLE, RED",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31021095",
    "description": "MICROFIBER RAGS BLUE 50PC/1BOX",
    "category": "SUPPLIES",
    "uom": "Box",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31021094",
    "description": "MICROFIBER RAGS GREEN 50PC/1BOX",
    "category": "SUPPLIES",
    "uom": "Box",
    "defaultQty": 1,
    "batchNo": ""
  },
  {
    "itemCode": "31021093",
    "description": "MICROFIBER RAGS YELLOW 50PC/1BOX",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31021092",
    "description": "MICROFIBER RAGS WHITE 50PCS/1BOX",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31021038",
    "description": "SCRUB SPONGE 75MMX75MM(12PC/PK)",
    "category": "SUPPLIES",
    "uom": "Pack",
    "defaultQty": 5,
    "batchNo": ""
  },
  {
    "itemCode": "21061120",
    "description": "CLING WRAP BIG,(15X500M)",
    "category": "SUPPLIES",
    "uom": "Roll",
    "defaultQty": 1,
    "batchNo": ""
  },
  {
    "itemCode": "21011102",
    "description": "COLOR CODED ROUND STICKER RED",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "21011103",
    "description": "COLOR CODED ROUND STICKER ORANGE",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "21011104",
    "description": "COLOR CODED ROUND STICKER YELLOW",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "21011105",
    "description": "COLOR CODED ROUND STICKER GREEN",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "21011106",
    "description": "COLOR CODED ROUND STICKER BLUE",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "21011107",
    "description": "COLOR CODED ROUND STICKER PURPLE",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "21011108",
    "description": "COLOR CODED ROUND STCIKER TURQUOISE",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "16-0388",
    "description": "Rubber Spatula 13.5\"",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "16-0389",
    "description": "Pizza Bar Pan 240x60x35",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "16-0390",
    "description": "Pizza Bar Gripper (L197xw64xH35)",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "16-0391",
    "description": "Pizza Bar Spatula (L180xW51xT1)",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "14-0218",
    "description": "Wet Floor Sign Caution",
    "category": "SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31011071",
    "description": "ALL STAR PREMIUM ALL PURPOSE CLEANER (120X30ML PER CASE)",
    "category": "JANITORIALS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31011132",
    "description": "SAFECARE PLUS ANTIBACTERIAL SOAP 4X5L PER CASE",
    "category": "JANITORIALS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31011147",
    "description": "I-LAB 70 PERCENT ALCOHOL 4GAL/CS",
    "category": "JANITORIALS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "41021034",
    "description": "PAPER TOWEL INTERFOLDED BROWN 175 SHEETS/PK",
    "category": "JANITORIALS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "41021035",
    "description": "PAPER TOWEL JUMBO ROLL TISSUE 12ROLLS/CASE",
    "category": "JANITORIALS",
    "uom": "Roll",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31011054",
    "description": "OVEN CLEANER 4LITERS",
    "category": "JANITORIALS",
    "uom": "Gal",
    "defaultQty": 4,
    "batchNo": ""
  },
  {
    "itemCode": "31011028",
    "description": "HAND SOAP LIQUID MANUPON 3.8L 4GAL /CASE",
    "category": "JANITORIALS",
    "uom": "Gal",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "41061000",
    "description": "BATHROOM TISSUE, FRESHIES",
    "category": "JANITORIALS",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31011069",
    "description": "SANIPLUS PQ SURFACE SANITIZER 4X4L PER CASE",
    "category": "JANITORIALS",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "31011141",
    "description": "SAFECARE BACTOFREE HAND GEL SANITIZER 10X500ML/CS",
    "category": "JANITORIALS",
    "uom": "Case",
    "defaultQty": 0.5,
    "batchNo": ""
  },
  {
    "itemCode": "41041092",
    "description": "FORM, DAILY SALES REPORT (20 PADS/PACK)",
    "category": "OFFICE SUPPLIES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "41031044",
    "description": "POS JOURNAL TAPE(50ROLLS/CASE)",
    "category": "OFFICE SUPPLIES",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "41031045",
    "description": "EPSON ERC-38 RIBBON FULL MARK 10PCS/CASE",
    "category": "OFFICE SUPPLIES",
    "uom": "Case",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "41031012",
    "description": "THERMAL PAPER 50ROLLS/CASE",
    "category": "OFFICE SUPPLIES",
    "uom": "Pack",
    "defaultQty": 100,
    "batchNo": ""
  },
  {
    "itemCode": "16-0234",
    "description": "Salt Shacker 8x4cm",
    "category": "OFFICE SUPPLIES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "16-0104",
    "description": "Sticker Label For Online Items 5Rolls/Pack",
    "category": "OFFICE SUPPLIES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "51021463",
    "description": "PIZZA SCREEN 9\" (6PCS/PACK)",
    "category": "WARES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "PIZZA SCREEN 11\"",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "PIZZA SCREEN 15\"",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "PIZZA SCREEN 18\"",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Pizza pan-small",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Pizza pan-medium",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Pizza pan-large",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Pizza stand",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "21061537",
    "description": "SQUEEZE BOTTLE WITH WHITE CAP FOR HOT HONEY 370ML",
    "category": "WARES",
    "uom": "Bot",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "SQUEEZE BOTTLE WITH NOZZLE FOR CHILI OIL 200ML",
    "category": "WARES",
    "uom": "Bot",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "STEP ON GARBAGE BIN",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "RUBBER SPATULA",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "ALUMINUM STOCKPOT 16QT",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "COVER,ALUM STOCKPOT 16Q",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "GREEN KNIFE",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "SPRAY GUN",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "BROOM BLACK WITH HANDLE",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "BLACK RUBBER GLOVES",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "WINDOW SQUEEGEE 18\"",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "PIZZA SCREEN 11\"",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "MOP HANDLE GREEN",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "MOP HANDLE BLUE",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "MOP HANDLE RED",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "MOP HEAD GREEN",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "MOP HEAD BLUE",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "MOP HEAD RED",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "DOUGH BIN",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "BLACK PIZZA CUTTER",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "21031004",
    "description": "TRANSIT BOX CORRUGATED 10PCS/BUNDLE",
    "category": "WARES",
    "uom": "Bundle",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "51011134",
    "description": "METAL BASKET BLACK SMALL",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "51011135",
    "description": "METAL BASKET BLACK BIG",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "51011133",
    "description": "PASTA PLATE, CIP LUZERNE NEW BONE 26CM",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "51011137",
    "description": "PASTA PLATE, LUZERNE 18CM",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "PASTA PLATE, LUZERNE 22CM",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Plate Black",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Plate White",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Chinaware 23.5",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Chinaware 26",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Melaware",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Gravy ware",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Bamboo Pizza Paddle 10.25\"x8.25\"",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Rectangle Pizza Screen 16x6",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "square rim Bowl",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Saucer",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Foodpan 1/19",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Foodpan 1/6",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Foodpan 1/3",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Pitcher w/o lid",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Pitcher with lid",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "white cup",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "yellow cup",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Bistro Carafe 940ml 6pcs/box (pithcer for juice-new product)",
    "category": "WARES",
    "uom": "Box",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Stainless-spoon",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Stainless-fork",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Stainless-knife",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Stainless-pizza cutter",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "black tray",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Mixing bowl Big",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Mixing bowl Small",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Pasta Plate Luzerne 22CM",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "Casablanca Glass 12OZ",
    "category": "WARES",
    "uom": "Pc",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "",
    "description": "GROUND BLACK PEPPER",
    "category": "WARES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  },
  {
    "itemCode": "13-0110",
    "description": "Plastic Pp Pizza Cutter (10Pcs, 100Pck/Case)",
    "category": "WARES",
    "uom": "Pack",
    "defaultQty": 0,
    "batchNo": ""
  }
];
