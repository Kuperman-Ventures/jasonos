import type { Location } from "./types";

export const LOCATIONS: Location[] = [
  // ── Lindon ──────────────────────────────────────────────────────────────
  {
    id: "grey-havens",
    regionId: "lindon",
    x: 110,
    y: 235,
    names: { third: "Grey Havens" },
    summary: "Elven harbors on the Gulf of Lhûn, the last shore of Middle-earth.",
    scenes: [
      {
        tale: "return-of-the-king",
        title: "The Ring-bearers sail",
        text: "Frodo, Bilbo, Gandalf, Elrond and Galadriel board a white ship and leave Middle-earth for the West.",
        source: "The Return of the King, Book VI, Chapter 9",
      },
      {
        tale: "return-of-the-king",
        title: "Sam returns home",
        text: "Sam watches the ship depart, then rides back to the Shire and his family at Bag End.",
        source: "The Return of the King, Book VI, Chapter 9",
      },
    ],
  },
  {
    id: "lindon",
    regionId: "lindon",
    x: 95,
    y: 275,
    names: { second: "Lindon", third: "Lindon" },
    summary: "Gil-galad's realm in the northwest, seat of High-elven power in the Second Age.",
    scenes: [
      {
        tale: "rop-s1",
        title: "Galadriel recalled",
        text: "After centuries hunting Sauron in the north, Galadriel is ordered home to Lindon by Gil-galad.",
        source: "Season 1, Episode 1",
      },
      {
        tale: "rop-s1",
        title: "The three rings begin",
        text: "Gil-galad and Celebrimbor weigh the peril of a new power rising while Lindon still stands open to the sea.",
        source: "Season 1, Episode 1",
      },
      {
        tale: "rop-s2",
        title: "Elven counsel",
        text: "The High King and his court face the cost of the Rings as war spreads east from Eregion.",
        source: "Season 2, Episode 1",
      },
    ],
  },

  // ── Eriador ─────────────────────────────────────────────────────────────
  {
    id: "hobbiton",
    regionId: "eriador",
    x: 250,
    y: 280,
    names: { third: "Hobbiton and the Shire" },
    summary: "Quiet hills of the Shire where Bilbo and Frodo begin their journeys.",
    scenes: [
      {
        tale: "hobbit",
        title: "An unexpected party",
        text: "Gandalf and thirteen dwarves arrive at Bag End and pull Bilbo into Thorin's quest for Erebor.",
        source: "The Hobbit, Chapter 1",
      },
      {
        tale: "fellowship",
        title: "A long-expected party",
        text: "Bilbo's eleventy-first birthday ends with him vanishing and leaving the Ring to Frodo.",
        source: "The Fellowship of the Ring, Book I, Chapter 1",
      },
      {
        tale: "fellowship",
        title: "Frodo leaves Bag End",
        text: "Frodo, Sam and Pippin set out from Hobbiton toward Crickhollow under cover of a move to Buckland.",
        source: "The Fellowship of the Ring, Book I, Chapter 3",
      },
      {
        tale: "return-of-the-king",
        title: "The Scouring of the Shire",
        text: "The four hobbits return to find the Shire industrialized under Sharkey's rule and raise the countryside against him.",
        source: "The Return of the King, Book VI, Chapter 8",
      },
    ],
  },
  {
    id: "old-forest",
    regionId: "eriador",
    x: 292,
    y: 298,
    names: { third: "Old Forest" },
    summary: "Ancient woods east of the Shire, watched by Tom Bombadil.",
    scenes: [
      {
        tale: "fellowship",
        title: "Into the Old Forest",
        text: "The hobbits take a short cut through the trees and are nearly trapped by Old Man Willow.",
        source: "The Fellowship of the Ring, Book I, Chapter 6",
      },
      {
        tale: "fellowship",
        title: "Tom Bombadil",
        text: "Tom rescues them, hosts them in his house, and later saves them from the Barrow-wights.",
        source: "The Fellowship of the Ring, Book I, Chapter 7",
      },
    ],
  },
  {
    id: "bree",
    regionId: "eriador",
    x: 325,
    y: 278,
    names: { third: "Bree" },
    summary: "Crossroads town of Men and hobbits at the edge of the wild.",
    scenes: [
      {
        tale: "fellowship",
        title: "At the Sign of the Prancing Pony",
        text: "Frodo meets Strider in the common-room after Pippin's careless talk draws dangerous attention.",
        source: "The Fellowship of the Ring, Book I, Chapter 9",
      },
      {
        tale: "fellowship",
        title: "A knife in the dark",
        text: "Black Riders raid the inn beds; the hobbits escape with Strider toward Weathertop.",
        source: "The Fellowship of the Ring, Book I, Chapter 10",
      },
      {
        tale: "return-of-the-king",
        title: "Home through Bree",
        text: "The companions pass back through Bree and learn how unrest has reached even this quiet town.",
        source: "The Return of the King, Book VI, Chapter 7",
      },
    ],
  },
  {
    id: "weathertop",
    regionId: "eriador",
    x: 370,
    y: 268,
    names: { third: "Weathertop" },
    summary: "Ruined watchtower of Amon Sûl on the East Road.",
    scenes: [
      {
        tale: "fellowship",
        title: "A knife in the dark",
        text: "The Nazgûl attack the camp on Weathertop and the Witch-king wounds Frodo with a Morgul blade.",
        source: "The Fellowship of the Ring, Book I, Chapter 11",
      },
    ],
  },
  {
    id: "trollshaws",
    regionId: "eriador",
    x: 405,
    y: 255,
    names: { third: "Trollshaws" },
    summary: "Stone-troll country west of the Misty Mountains.",
    scenes: [
      {
        tale: "hobbit",
        title: "Roast mutton",
        text: "Bilbo and the dwarves are captured by three trolls until Gandalf tricks them into daylight.",
        source: "The Hobbit, Chapter 2",
      },
      {
        tale: "fellowship",
        title: "The stone trolls",
        text: "Strider leads the hobbits past the same petrified trolls Bilbo once met on the road to Rivendell.",
        source: "The Fellowship of the Ring, Book I, Chapter 12",
      },
    ],
  },
  {
    id: "rivendell",
    regionId: "eriador",
    x: 430,
    y: 245,
    names: { second: "Rivendell", third: "Rivendell" },
    summary: "Elrond's hidden valley refuge in the foothills of the Misty Mountains.",
    scenes: [
      {
        tale: "hobbit",
        title: "A short rest",
        text: "Elrond reads the moon-letters on Thror's map and points Thorin toward the secret door on Durin's Day.",
        source: "The Hobbit, Chapter 3",
      },
      {
        tale: "fellowship",
        title: "Many Meetings",
        text: "Frodo wakes in Rivendell, reunites with Bilbo, and learns how close the Nazgûl came.",
        source: "The Fellowship of the Ring, Book II, Chapter 1",
      },
      {
        tale: "fellowship",
        title: "The Council of Elrond",
        text: "Representatives of Free Peoples decide the Ring must go to Mount Doom and form the Fellowship.",
        source: "The Fellowship of the Ring, Book II, Chapter 2",
      },
      {
        tale: "rop-s2",
        title: "A new haven",
        text: "Elrond and survivors of the war seek a lasting refuge that will become the valley of Rivendell.",
        source: "Season 2, Episode 8",
      },
    ],
  },

  // ── Eregion And Moria ───────────────────────────────────────────────────
  {
    id: "ost-in-edhil",
    regionId: "eregion-moria",
    x: 415,
    y: 340,
    names: { second: "Ost-in-Edhil" },
    summary: "Capital of Eregion, where Celebrimbor's smiths forged the Rings of Power.",
    scenes: [
      {
        tale: "rop-s1",
        title: "The smiths of Eregion",
        text: "Celebrimbor welcomes new craft and counsel as Ost-in-Edhil becomes the heart of ring-lore.",
        source: "Season 1, Episode 2",
      },
      {
        tale: "rop-s1",
        title: "A stranger in the city",
        text: "Halbrand arrives among the Elven-smiths while Celebrimbor pursues a greater work in mithril.",
        source: "Season 1, Episode 8",
      },
      {
        tale: "rop-s2",
        title: "Siege of Eregion",
        text: "Adar's armies storm Ost-in-Edhil; Celebrimbor's city falls as Sauron's designs come clear.",
        source: "Season 2, Episode 7",
      },
      {
        tale: "rop-s2",
        title: "The rings take shape",
        text: "Under mounting pressure, Celebrimbor completes rings whose making will reshape the age.",
        source: "Season 2, Episode 6",
      },
    ],
  },
  {
    id: "khazad-dum",
    regionId: "eregion-moria",
    x: 448,
    y: 348,
    names: { second: "Khazad-dum", third: "Moria" },
    summary: "The great dwarf-kingdom under the Misty Mountains, later called Moria.",
    scenes: [
      {
        tale: "rop-s1",
        title: "Elrond and Durin",
        text: "Elrond renews his friendship with Prince Durin and sees the wealth and strain inside Khazad-dum.",
        source: "Season 1, Episode 2",
      },
      {
        tale: "rop-s1",
        title: "The mithril discovery",
        text: "A vein of mithril is revealed beneath the mountain, binding Elven need to Dwarven pride.",
        source: "Season 1, Episode 5",
      },
      {
        tale: "fellowship",
        title: "A Journey in the Dark",
        text: "The Fellowship enters Moria by the West-gate, passes through the halls, and finds Balin's tomb.",
        source: "The Fellowship of the Ring, Book II, Chapter 4",
      },
      {
        tale: "fellowship",
        title: "The Bridge of Khazad-dum",
        text: "Gandalf faces the Balrog on the bridge and falls into shadow while the others escape east.",
        source: "The Fellowship of the Ring, Book II, Chapter 5",
      },
      {
        tale: "rop-s2",
        title: "Dwarven halls under threat",
        text: "Durin's people confront upheaval inside the mountain as alliances with the Elves fray.",
        source: "Season 2, Episode 3",
      },
    ],
  },

  // ── Rhovanion ───────────────────────────────────────────────────────────
  {
    id: "goblin-town",
    regionId: "rhovanion",
    x: 452,
    y: 215,
    names: { third: "Goblin-town and the High Pass" },
    summary: "Goblin tunnels under the Misty Mountains on the path to Wilderland.",
    scenes: [
      {
        tale: "hobbit",
        title: "Over Hill and Under Hill",
        text: "Goblin captors drag Thorin's company into the mountain; Gandalf frees them in the chaos.",
        source: "The Hobbit, Chapter 4",
      },
      {
        tale: "hobbit",
        title: "Riddles in the Dark",
        text: "Bilbo finds the Ring in the tunnels and matches riddles with Gollum before escaping the back door.",
        source: "The Hobbit, Chapter 5",
      },
    ],
  },
  {
    id: "beorns-house",
    regionId: "rhovanion",
    x: 515,
    y: 235,
    names: { third: "Beorn's House" },
    summary: "The skin-changer's hall between the mountains and Mirkwood.",
    scenes: [
      {
        tale: "hobbit",
        title: "Queer lodgings",
        text: "Gandalf brings the company to Beorn, who feeds them and later aids their road into Mirkwood.",
        source: "The Hobbit, Chapter 7",
      },
    ],
  },
  {
    id: "mirkwood",
    regionId: "rhovanion",
    x: 600,
    y: 205,
    names: { third: "Mirkwood and the Elvenking's Halls" },
    summary: "The great forest of Greenwood the Great, darkened and ruled by Thranduil.",
    scenes: [
      {
        tale: "hobbit",
        title: "Flies and Spiders",
        text: "The dwarves leave the path, fall to spiders, and are rescued by Bilbo with the Ring and Sting.",
        source: "The Hobbit, Chapter 8",
      },
      {
        tale: "hobbit",
        title: "Barrels out of Bond",
        text: "Thranduil imprisons the dwarves; Bilbo frees them by floating them downriver in empty barrels.",
        source: "The Hobbit, Chapter 9",
      },
    ],
  },
  {
    id: "lake-town",
    regionId: "rhovanion",
    x: 705,
    y: 175,
    names: { third: "Lake-town" },
    summary: "Esgaroth on the Long Lake, trade hub below the Lonely Mountain.",
    scenes: [
      {
        tale: "hobbit",
        title: "A Warm Welcome",
        text: "The Master of Lake-town greets Thorin as the returning King under the Mountain.",
        source: "The Hobbit, Chapter 10",
      },
      {
        tale: "hobbit",
        title: "Fire and water",
        text: "Smaug descends on Lake-town; Bard the Bowman fells the dragon with a black arrow.",
        source: "The Hobbit, Chapter 14",
      },
    ],
  },
  {
    id: "erebor",
    regionId: "rhovanion",
    x: 720,
    y: 138,
    names: { third: "Erebor and Dale" },
    summary: "The Lonely Mountain and the ruined city of Dale at its feet.",
    scenes: [
      {
        tale: "hobbit",
        title: "Inside information",
        text: "Bilbo enters Smaug's hall by the secret door and steals a cup, waking the dragon's wrath.",
        source: "The Hobbit, Chapter 12",
      },
      {
        tale: "hobbit",
        title: "The gathering of the clouds",
        text: "After Smaug's death, elves, men and dwarves dispute the hoard while a goblin army approaches.",
        source: "The Hobbit, Chapter 15",
      },
      {
        tale: "hobbit",
        title: "The Clouds Burst",
        text: "The Battle of Five Armies is fought before the mountain; Thorin falls reclaiming his honor.",
        source: "The Hobbit, Chapter 17",
      },
    ],
  },
  {
    id: "dol-guldur",
    regionId: "rhovanion",
    x: 565,
    y: 365,
    names: { second: "Dol Guldur", third: "Dol Guldur" },
    summary: "Stronghold in southern Mirkwood, long held by the Necromancer.",
    scenes: [
      {
        tale: "hobbit",
        title: "The Necromancer of Dol Guldur",
        text: "Gandalf explains that the White Council has driven the Necromancer from his fortress in the south of the forest.",
        source: "The Hobbit, Chapter 19",
      },
      {
        tale: "fellowship",
        title: "The Shadow in Mirkwood",
        text: "At the Council, the wise recount how Sauron's return was first felt as a shadow in Dol Guldur.",
        source: "The Fellowship of the Ring, Book II, Chapter 2",
      },
    ],
  },
  {
    id: "lothlorien",
    regionId: "rhovanion",
    x: 500,
    y: 365,
    names: { third: "Lothlorien" },
    summary: "Galadriel and Celeborn's golden wood east of the mountains.",
    scenes: [
      {
        tale: "fellowship",
        title: "Lothlorien",
        text: "The Fellowship is led blindfold into the wood and brought before the Lord and Lady of the Galadhrim.",
        source: "The Fellowship of the Ring, Book II, Chapter 6",
      },
      {
        tale: "fellowship",
        title: "The Mirror of Galadriel",
        text: "Frodo and Sam look into Galadriel's Mirror; she refuses the Ring when Frodo offers it.",
        source: "The Fellowship of the Ring, Book II, Chapter 7",
      },
      {
        tale: "fellowship",
        title: "Farewell to Lorien",
        text: "The Company receives cloaks, lembas, boats and the Phial of Galadriel before taking the river south.",
        source: "The Fellowship of the Ring, Book II, Chapter 8",
      },
    ],
  },

  // ── Rohan And Isengard ──────────────────────────────────────────────────
  {
    id: "fangorn",
    regionId: "rohan-isengard",
    x: 495,
    y: 430,
    names: { third: "Fangorn" },
    summary: "Entish forest on the borders of Rohan, home of Treebeard.",
    scenes: [
      {
        tale: "two-towers",
        title: "Treebeard",
        text: "Merry and Pippin meet Treebeard and are taken into the heart of Fangorn.",
        source: "The Two Towers, Book III, Chapter 4",
      },
      {
        tale: "two-towers",
        title: "The Entmoot",
        text: "The Ents debate Saruman's threat and resolve to march on Isengard.",
        source: "The Two Towers, Book III, Chapter 4",
      },
    ],
  },
  {
    id: "isengard",
    regionId: "rohan-isengard",
    x: 448,
    y: 472,
    names: { third: "Isengard" },
    summary: "Saruman's ring of stone around Orthanc at the foot of the Misty Mountains.",
    scenes: [
      {
        tale: "two-towers",
        title: "The Road to Isengard",
        text: "The Ents flood the ring of Isengard and leave Saruman trapped in Orthanc.",
        source: "The Two Towers, Book III, Chapter 8",
      },
      {
        tale: "two-towers",
        title: "Flotsam and Jetsam",
        text: "Merry and Pippin tell Aragorn's company how the Ents broke the gates and dams.",
        source: "The Two Towers, Book III, Chapter 9",
      },
      {
        tale: "two-towers",
        title: "The Voice of Saruman",
        text: "Gandalf breaks Saruman's staff after the wizard tries to sway them from Orthanc's steps.",
        source: "The Two Towers, Book III, Chapter 10",
      },
    ],
  },
  {
    id: "helms-deep",
    regionId: "rohan-isengard",
    x: 475,
    y: 532,
    names: { third: "Helm's Deep" },
    summary: "The Hornburg fortress in the Deeping Coomb of Rohan.",
    scenes: [
      {
        tale: "two-towers",
        title: "Helm's Deep",
        text: "Theoden's people hold the Hornburg through the night against Saruman's army.",
        source: "The Two Towers, Book III, Chapter 7",
      },
      {
        tale: "two-towers",
        title: "Dawn at the Deep",
        text: "Gandalf arrives with Erkenbrand as the Huorns close on the fleeing orcs.",
        source: "The Two Towers, Book III, Chapter 7",
      },
    ],
  },
  {
    id: "edoras",
    regionId: "rohan-isengard",
    x: 535,
    y: 538,
    names: { third: "Edoras" },
    summary: "Capital of Rohan, crowned by the golden hall of Meduseld.",
    scenes: [
      {
        tale: "two-towers",
        title: "The King of the Golden Hall",
        text: "Gandalf frees Theoden from Wormtongue's counsel and stirs Rohan to war.",
        source: "The Two Towers, Book III, Chapter 6",
      },
      {
        tale: "return-of-the-king",
        title: "Many Partings",
        text: "After the war, the companions return through Edoras for Theoden's funeral and Eomer's kingship.",
        source: "The Return of the King, Book VI, Chapter 6",
      },
    ],
  },
  {
    id: "dunharrow",
    regionId: "rohan-isengard",
    x: 550,
    y: 558,
    names: { third: "Dunharrow" },
    summary: "Mountain refuge of Rohan above the Paths of the Dead.",
    scenes: [
      {
        tale: "return-of-the-king",
        title: "The Muster of Rohan",
        text: "Theoden gathers the Riders at Dunharrow while Aragorn takes a darker road.",
        source: "The Return of the King, Book V, Chapter 3",
      },
      {
        tale: "return-of-the-king",
        title: "The Passing of the Grey Company",
        text: "Aragorn, Legolas and Gimli enter the Paths of the Dead from the Hold of Dunharrow.",
        source: "The Return of the King, Book V, Chapter 2",
      },
    ],
  },
  {
    id: "amon-hen",
    regionId: "rohan-isengard",
    x: 595,
    y: 485,
    names: { third: "Amon Hen and Rauros" },
    summary: "Hill of Seeing above the falls where the Fellowship breaks.",
    scenes: [
      {
        tale: "fellowship",
        title: "The Breaking of the Fellowship",
        text: "Boromir tries to take the Ring; Frodo and Sam leave by boat while orcs seize Merry and Pippin.",
        source: "The Fellowship of the Ring, Book II, Chapter 10",
      },
      {
        tale: "two-towers",
        title: "The Departure of Boromir",
        text: "Aragorn finds Boromir dying; the three hunters lay him in a boat and send him over Rauros.",
        source: "The Two Towers, Book III, Chapter 1",
      },
    ],
  },

  // ── Gondor ──────────────────────────────────────────────────────────────
  {
    id: "minas-tirith",
    regionId: "gondor",
    x: 660,
    y: 555,
    names: { third: "Minas Tirith and the Pelennor Fields" },
    summary: "The seven-tiered city of Gondor and the fields before its gate.",
    scenes: [
      {
        tale: "return-of-the-king",
        title: "Minas Tirith",
        text: "Pippin and Gandalf enter the city and stand before Denethor in the hall of the Stewards.",
        source: "The Return of the King, Book V, Chapter 1",
      },
      {
        tale: "return-of-the-king",
        title: "The Siege of Gondor",
        text: "The hosts of Mordor close on the city; the Gate is broken as Denethor's despair deepens.",
        source: "The Return of the King, Book V, Chapter 4",
      },
      {
        tale: "return-of-the-king",
        title: "The Ride of the Rohirrim",
        text: "Theoden's charge breaks the first assault on the Pelennor as the black ships draw near.",
        source: "The Return of the King, Book V, Chapter 5",
      },
      {
        tale: "return-of-the-king",
        title: "The Battle of the Pelennor Fields",
        text: "Aragorn arrives with the fleet; the Witch-king falls to Eowyn and Merry before the city is relieved.",
        source: "The Return of the King, Book V, Chapter 6",
      },
    ],
  },
  {
    id: "osgiliath",
    regionId: "gondor",
    x: 682,
    y: 542,
    names: { third: "Osgiliath" },
    summary: "Former capital of Gondor on the Anduin, long fought over with Mordor.",
    scenes: [
      {
        tale: "two-towers",
        title: "The window on the west",
        text: "Faramir speaks of the struggle for Osgiliath while holding Frodo and Sam in Henneth Annun.",
        source: "The Two Towers, Book IV, Chapter 5",
      },
      {
        tale: "return-of-the-king",
        title: "Faramir's retreat",
        text: "Faramir falls wounded covering the retreat from Osgiliath as Mordor's advance reaches the Rammas.",
        source: "The Return of the King, Book V, Chapter 4",
      },
    ],
  },
  {
    id: "ithilien",
    regionId: "gondor",
    x: 698,
    y: 518,
    names: { third: "Ithilien and Henneth Annun" },
    summary: "Garden land of Gondor east of Anduin, base of Faramir's rangers.",
    scenes: [
      {
        tale: "two-towers",
        title: "Of Herbs and Stewed Rabbit",
        text: "Frodo and Sam rest in Ithilien and are taken by Faramir's men after Gollum slips away.",
        source: "The Two Towers, Book IV, Chapter 4",
      },
      {
        tale: "two-towers",
        title: "The Forbidden Pool",
        text: "Faramir tests Frodo at Henneth Annun, then chooses to let the hobbits go toward Mordor.",
        source: "The Two Towers, Book IV, Chapter 6",
      },
    ],
  },
  {
    id: "pelargir",
    regionId: "gondor",
    x: 595,
    y: 665,
    names: { third: "Pelargir" },
    summary: "Great southern haven of Gondor on the Anduin estuary.",
    scenes: [
      {
        tale: "return-of-the-king",
        title: "The Last Debate's fleet",
        text: "Aragorn seizes the Corsair ships at Pelargir with the Dead and sails them to the Pelennor.",
        source: "The Return of the King, Book V, Chapter 9",
      },
    ],
  },

  // ── Mordor / The Southlands ─────────────────────────────────────────────
  {
    id: "dead-marshes",
    regionId: "mordor-southlands",
    x: 665,
    y: 458,
    names: { third: "Dead Marshes" },
    summary: "Haunted wetlands west of the Black Gate.",
    scenes: [
      {
        tale: "two-towers",
        title: "The Passage of the Marshes",
        text: "Gollum leads Frodo and Sam through the Dead Marshes past the faces of the dead under the water.",
        source: "The Two Towers, Book IV, Chapter 2",
      },
    ],
  },
  {
    id: "black-gate",
    regionId: "mordor-southlands",
    x: 702,
    y: 468,
    names: { third: "Black Gate" },
    summary: "Morannon, the fortified northern entrance to Mordor.",
    scenes: [
      {
        tale: "two-towers",
        title: "The Black Gate is Closed",
        text: "Frodo sees the Gate is impassable; Gollum urges another road through the mountains of shadow.",
        source: "The Two Towers, Book IV, Chapter 3",
      },
      {
        tale: "return-of-the-king",
        title: "The Black Gate Opens",
        text: "Aragorn's host challenges Sauron at the Gate to draw the Eye from Frodo.",
        source: "The Return of the King, Book V, Chapter 10",
      },
    ],
  },
  {
    id: "minas-morgul",
    regionId: "mordor-southlands",
    x: 722,
    y: 548,
    names: { third: "Minas Morgul" },
    summary: "Once Minas Ithil, now the Witch-king's foul city in the Morgul Vale.",
    scenes: [
      {
        tale: "two-towers",
        title: "Journey to the Cross-roads",
        text: "Frodo and Sam approach the Morgul Vale and watch the army of Minas Morgul march to war.",
        source: "The Two Towers, Book IV, Chapter 7",
      },
      {
        tale: "two-towers",
        title: "The Stairs of Cirith Ungol",
        text: "Gollum leads them past the city onto the stairs that climb toward Shelob's lair.",
        source: "The Two Towers, Book IV, Chapter 8",
      },
    ],
  },
  {
    id: "cirith-ungol",
    regionId: "mordor-southlands",
    x: 738,
    y: 535,
    names: { third: "Cirith Ungol" },
    summary: "High pass and tower above Shelob's tunnels into Mordor.",
    scenes: [
      {
        tale: "two-towers",
        title: "Shelob's Lair",
        text: "Shelob stings Frodo; Sam fights her off with Sting and the Phial of Galadriel.",
        source: "The Two Towers, Book IV, Chapter 9",
      },
      {
        tale: "two-towers",
        title: "The Choices of Master Samwise",
        text: "Orcs carry Frodo into the Tower of Cirith Ungol; Sam takes the Ring and follows.",
        source: "The Two Towers, Book IV, Chapter 10",
      },
      {
        tale: "return-of-the-king",
        title: "The Tower of Cirith Ungol",
        text: "Sam rescues Frodo from the tower as the orc garrison destroys itself in a quarrel.",
        source: "The Return of the King, Book VI, Chapter 1",
      },
    ],
  },
  {
    id: "mount-doom",
    regionId: "mordor-southlands",
    x: 772,
    y: 518,
    names: { third: "Mount Doom" },
    summary: "Orodruin, the volcano where the One Ring was forged and unmade.",
    scenes: [
      {
        tale: "return-of-the-king",
        title: "Mount Doom",
        text: "Frodo claims the Ring at the Crack of Doom; Gollum seizes it and falls into the fire.",
        source: "The Return of the King, Book VI, Chapter 3",
      },
      {
        tale: "return-of-the-king",
        title: "The Field of Cormallen",
        text: "Gandalf's eagles bear Frodo and Sam from the erupting mountain after the Ring is destroyed.",
        source: "The Return of the King, Book VI, Chapter 4",
      },
    ],
  },
  {
    id: "barad-dur",
    regionId: "mordor-southlands",
    x: 825,
    y: 498,
    names: { third: "Barad-dur" },
    summary: "The Dark Tower, Sauron's seat in Mordor.",
    scenes: [
      {
        tale: "return-of-the-king",
        title: "The Eye is blinded",
        text: "When the Ring is destroyed, Barad-dur collapses and Sauron's power breaks across Mordor.",
        source: "The Return of the King, Book VI, Chapter 3",
      },
      {
        tale: "return-of-the-king",
        title: "The hosts of Mordor flee",
        text: "At the Black Gate the armies of Mordor scatter as the Dark Tower falls.",
        source: "The Return of the King, Book VI, Chapter 4",
      },
    ],
  },
  {
    id: "tirharad",
    regionId: "mordor-southlands",
    x: 748,
    y: 595,
    names: { second: "Tirharad and Ostirith" },
    summary: "Southlands villages and the Elven watchtower before the land becomes Mordor.",
    scenes: [
      {
        tale: "rop-s1",
        title: "Life in Tirharad",
        text: "Bronwyn, Theo and Arondir struggle to hold a fragile peace in the Southlands villages.",
        source: "Season 1, Episode 1",
      },
      {
        tale: "rop-s1",
        title: "Ostirith under siege",
        text: "Villagers take refuge in the watchtower as orcs press the valley and the dam's secret nears release.",
        source: "Season 1, Episode 6",
      },
      {
        tale: "rop-s1",
        title: "The Southlands burn",
        text: "A volcanic eruption remakes the land; the Southlands begin their turn into Mordor.",
        source: "Season 1, Episode 7",
      },
      {
        tale: "rop-s2",
        title: "Adar's Mordor",
        text: "Adar consolidates power in the ash-lands that were once the Southlands.",
        source: "Season 2, Episode 1",
      },
    ],
  },

  // ── Rhun ────────────────────────────────────────────────────────────────
  {
    id: "rhun",
    regionId: "rhun",
    x: 905,
    y: 345,
    names: { second: "Rhun" },
    summary: "The wide East beyond the Sea of Rhun, little known to the West.",
    scenes: [
      {
        tale: "rop-s1",
        title: "Toward the East",
        text: "The Stranger and Nori leave the Harfoots' path and set out toward the lands of Rhun.",
        source: "Season 1, Episode 8",
      },
      {
        tale: "rop-s2",
        title: "Desert and temple",
        text: "In Rhun the Stranger seeks his name while dark cults and lost Istari trails cross the waste.",
        source: "Season 2, Episode 2",
      },
      {
        tale: "rop-s2",
        title: "The Stoors",
        text: "Nori finds other hobbit-kind living in Rhun and weighs whether to stay or follow her friend.",
        source: "Season 2, Episode 4",
      },
    ],
  },

  // ── The North ───────────────────────────────────────────────────────────
  {
    id: "forodwaith",
    regionId: "the-north",
    x: 340,
    y: 55,
    names: { second: "Forodwaith" },
    summary: "Frozen northern waste where Galadriel's company hunted Sauron's trail.",
    scenes: [
      {
        tale: "rop-s1",
        title: "The hunt in the ice",
        text: "Galadriel leads her company across Forodwaith and finds a sigil in an abandoned fortress of the enemy.",
        source: "Season 1, Episode 1",
      },
      {
        tale: "rop-s1",
        title: "Company refused",
        text: "Her soldiers refuse to continue; Galadriel alone will not abandon the search for Sauron.",
        source: "Season 1, Episode 1",
      },
    ],
  },

  // ── Numenor And The Sea ─────────────────────────────────────────────────
  {
    id: "numenor",
    regionId: "numenor-sea",
    x: 95,
    y: 640,
    names: { second: "Numenor and Armenelos" },
    summary: "The island kingdom of the Dunedain and its capital Armenelos.",
    scenes: [
      {
        tale: "rop-s1",
        title: "Arrival in Numenor",
        text: "Galadriel and Halbrand wash ashore and are brought into the politics of Armenelos.",
        source: "Season 1, Episode 3",
      },
      {
        tale: "rop-s1",
        title: "Queen Regent's court",
        text: "Miriel and Pharazon weigh alliance with the Elves while the Faithful and King's Men divide the isle.",
        source: "Season 1, Episode 3",
      },
      {
        tale: "rop-s1",
        title: "The expedition sails",
        text: "Numenor launches ships to the Southlands, binding the island's fate to the war on the mainland.",
        source: "Season 1, Episode 5",
      },
      {
        tale: "rop-s2",
        title: "Pharazon's rise",
        text: "After Miriel's trials, Pharazon tightens his grip on Numenor and turns the isle against the Faithful.",
        source: "Season 2, Episode 5",
      },
    ],
  },
  {
    id: "sundering-seas",
    regionId: "numenor-sea",
    x: 45,
    y: 455,
    names: { second: "The Sundering Seas" },
    summary: "The great waters between Middle-earth, Numenor and the Undying Lands.",
    scenes: [
      {
        tale: "rop-s1",
        title: "Castaways",
        text: "Galadriel leaps from the ship bound West and is found adrift with Halbrand after a sea-wyrm attack.",
        source: "Season 1, Episode 2",
      },
      {
        tale: "rop-s1",
        title: "Crossing to Numenor",
        text: "Elendil's ship lifts the castaways from the sea and bears them to the island of Numenor.",
        source: "Season 1, Episode 3",
      },
    ],
  },
  {
    id: "valinor",
    regionId: "numenor-sea",
    x: 18,
    y: 280,
    names: { second: "To Valinor", third: "To Valinor" },
    summary: "Edge marker for the Undying Lands beyond the bent seas.",
    scenes: [
      {
        tale: "rop-s1",
        title: "The road West refused",
        text: "Galadriel is offered passage to Valinor and turns back to Middle-earth before the ship reaches the light.",
        source: "Season 1, Episode 1",
      },
      {
        tale: "return-of-the-king",
        title: "The White Ship",
        text: "At the end of the Third Age the Ring-bearers take the last road over Sea toward Valinor.",
        source: "The Return of the King, Book VI, Chapter 9",
      },
    ],
  },
];
