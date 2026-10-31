// Basecamp Games: practice questions for rank advancement.
//
// Every question here is written fresh for Basecamp (no handbook text is
// copied). They cover the skills and ideas Scouts learn on the trail to
// First Class and beyond, grouped by the rank where they usually come up.
// Leaders can add or fix questions right here; the server scores answers
// from this same file.
//
// Types:
//   mc       c: choices, a: index of the right one
//   tf       true/false; a: true | false
//   order    o: items in the right order (shown shuffled)
//   match    m: [left, right] pairs (rights shown shuffled)
//   scramble w: word to unscramble, hint
// Every question has: id, r (rank), t (topic), q (question), why (explanation)

export const RANKS = [
  { id: 'scout', label: 'Scout' }, { id: 'tenderfoot', label: 'Tenderfoot' }, { id: 'second', label: 'Second Class' },
  { id: 'first', label: 'First Class' }, { id: 'star', label: 'Star–Eagle' },
];
export const TOPICS = [
  { id: 'spirit', label: 'Oath, Law & Spirit', emoji: '⚜️' },
  { id: 'knots', label: 'Knots & Lashings', emoji: '🪢' },
  { id: 'firstaid', label: 'First Aid', emoji: '⛑️' },
  { id: 'camping', label: 'Camping & Fire', emoji: '🏕️' },
  { id: 'cooking', label: 'Cooking', emoji: '🍳' },
  { id: 'nav', label: 'Map & Compass', emoji: '🧭' },
  { id: 'nature', label: 'Nature & Weather', emoji: '🌿' },
  { id: 'lnt', label: 'Leave No Trace', emoji: '🥾' },
  { id: 'safety', label: 'Safety & Swimming', emoji: '🛟' },
  { id: 'citizen', label: 'Citizenship & Flag', emoji: '🇺🇸' },
  { id: 'leader', label: 'Patrol & Leadership', emoji: '🧑‍🤝‍🧑' },
  { id: 'advance', label: 'Trail to Eagle', emoji: '🦅' },
];

const tf = (id, r, t, q, a, why) => ({ id, r, t, type: 'tf', q, a, why });
const mc = (id, r, t, q, c, a, why) => ({ id, r, t, type: 'mc', q, c, a, why });

export const QUESTIONS = [
  // ------------------------------------------------------------ Oath, Law & Spirit
  mc('sp1', 'scout', 'spirit', 'What is the Scout motto?', ['Do Your Best', 'Be Prepared', 'Do a Good Turn Daily', 'Always Ready'], 1, '“Be Prepared” is the motto. “Do a Good Turn Daily” is the slogan, and “Do Your Best” is the Cub Scout motto.'),
  mc('sp2', 'scout', 'spirit', 'What is the Scout slogan?', ['Be Prepared', 'Leave It Better', 'Do a Good Turn Daily', 'Once a Scout, Always a Scout'], 2, 'The slogan reminds Scouts to help someone every day without expecting anything back.'),
  mc('sp3', 'scout', 'spirit', 'How many points are in the Scout Law?', ['10', '12', '7', '3'], 1, 'There are 12 points, from Trustworthy to Reverent.'),
  { id: 'sp4', r: 'scout', t: 'spirit', type: 'order', q: 'Put the 12 points of the Scout Law in order.', o: ['Trustworthy', 'Loyal', 'Helpful', 'Friendly', 'Courteous', 'Kind', 'Obedient', 'Cheerful', 'Thrifty', 'Brave', 'Clean', 'Reverent'], why: 'A Scout is Trustworthy, Loyal, Helpful, Friendly, Courteous, Kind, Obedient, Cheerful, Thrifty, Brave, Clean and Reverent.' },
  mc('sp5', 'scout', 'spirit', 'Which point of the Scout Law comes right after “Friendly”?', ['Kind', 'Helpful', 'Courteous', 'Cheerful'], 2, '…Helpful, Friendly, Courteous, Kind…'),
  mc('sp6', 'scout', 'spirit', 'Telling the truth and keeping your promises is the heart of which point?', ['Loyal', 'Trustworthy', 'Obedient', 'Brave'], 1, 'Being Trustworthy means people can count on what you say and do.'),
  mc('sp7', 'scout', 'spirit', 'Saving money, sharing, and not wasting food or supplies fits which point?', ['Thrifty', 'Clean', 'Helpful', 'Kind'], 0, 'Thrifty Scouts take care of what they have and use it wisely.'),
  mc('sp8', 'scout', 'spirit', 'Standing up for someone being picked on, even when you feel scared, shows which point?', ['Cheerful', 'Brave', 'Loyal', 'Courteous'], 1, 'Bravery isn\'t having no fear — it\'s doing the right thing anyway.'),
  mc('sp9', 'scout', 'spirit', 'How many fingers are raised in the Scout sign?', ['Two', 'Three', 'Four', 'Five'], 1, 'Three fingers up, with the thumb holding down the little finger.'),
  mc('sp10', 'scout', 'spirit', 'The three raised fingers of the Scout sign stand for…', ['The three parts of the Scout Oath', 'Three ranks', 'Faith, hope and charity', 'Patrol, troop and council'], 0, 'Each finger is one of the Oath\'s three duties: to God and country, to other people, and to yourself.'),
  mc('sp11', 'scout', 'spirit', 'Scouts shake hands using which hand?', ['Right', 'Left', 'Either one', 'Both'], 1, 'The Scout handshake uses the left hand. Scouts around the world greet each other this way.'),
  tf('sp12', 'scout', 'spirit', 'A Good Turn should be done without expecting a reward.', true, 'That\'s what makes it a Good Turn: you help because it\'s right, not to get something.'),
  mc('sp13', 'scout', 'spirit', '“Scout spirit” mostly means…', ['Wearing the full uniform', 'Living the Scout Oath and Law in everyday life', 'Winning patrol competitions', 'Earning lots of merit badges'], 1, 'Scout spirit shows in how you act at home, at school and in your community — not just at meetings.'),
  { id: 'sp14', r: 'scout', t: 'spirit', type: 'scramble', q: 'Unscramble this point of the Scout Law.', w: 'COURTEOUS', hint: 'Polite to everyone', why: 'A Scout is Courteous — polite to everyone, regardless of age or position.' },
  { id: 'sp15', r: 'scout', t: 'spirit', type: 'scramble', q: 'Unscramble this point of the Scout Law.', w: 'REVERENT', hint: 'The 12th point', why: 'A Scout is Reverent — faithful in religious duties and respectful of others\' beliefs.' },
  { id: 'sp16', r: 'scout', t: 'spirit', type: 'scramble', q: 'Unscramble the Scout motto\'s last word.', w: 'PREPARED', hint: 'Be ________', why: 'Be Prepared — for whatever comes your way.' },
  mc('sp17', 'tenderfoot', 'spirit', 'A Scout who keeps a positive attitude when it rains all weekend at camp is showing which point?', ['Cheerful', 'Clean', 'Obedient', 'Thrifty'], 0, 'Cheerful Scouts look for the bright side and help others do the same.'),
  tf('sp18', 'scout', 'spirit', 'The Scout salute is used to salute the U.S. flag when you\'re in uniform.', true, 'In uniform, Scouts give the Scout salute; out of uniform, they place the right hand over the heart.'),

  // ------------------------------------------------------------ Knots & Lashings
  mc('kn1', 'scout', 'knots', 'Which knot is best for tying two ropes of the same thickness together, or tying a bandage?', ['Square knot', 'Taut-line hitch', 'Bowline', 'Timber hitch'], 0, 'The square knot lies flat — great for bandages and joining same-size ropes (not for heavy loads).'),
  mc('kn2', 'scout', 'knots', 'Which knot makes an adjustable loop, perfect for tent guylines?', ['Two half hitches', 'Taut-line hitch', 'Sheet bend', 'Square knot'], 1, 'Slide a taut-line hitch to tighten or loosen a guyline, and it holds when the line is under tension.'),
  mc('kn3', 'scout', 'knots', 'Two half hitches are used to…', ['Join two ropes', 'Tie a rope to a post, ring or tree', 'Shorten a rope', 'Make a ladder'], 1, 'Two half hitches fasten a rope to an object, like a post or a grommet.'),
  tf('kn4', 'scout', 'knots', 'A square knot is tied “right over left, then left over right.”', true, 'If you go right over left twice, you get a granny knot, which can slip or jam.'),
  mc('kn5', 'second', 'knots', 'Which knot makes a fixed loop that won\'t slip — the one used in rescues?', ['Bowline', 'Clove hitch', 'Taut-line hitch', 'Sheet bend'], 0, 'A bowline\'s loop stays the same size under load, so it\'s used for rescue and mooring.'),
  mc('kn6', 'first', 'knots', 'Which knot joins two ropes of different thicknesses?', ['Square knot', 'Sheet bend', 'Bowline', 'Two half hitches'], 1, 'A sheet bend holds ropes of different sizes, where a square knot would slip.'),
  mc('kn7', 'first', 'knots', 'Square lashing starts and ends with which knot?', ['Timber hitch', 'Clove hitch', 'Bowline', 'Square knot'], 1, 'Clove hitch to start, wraps and fraps, then a clove hitch to finish.'),
  mc('kn8', 'first', 'knots', 'Diagonal lashing usually starts with which knot?', ['Timber hitch', 'Sheet bend', 'Square knot', 'Bowline'], 0, 'A timber hitch pulls the two poles together where they cross.'),
  mc('kn9', 'first', 'knots', 'Which lashing joins two poles that cross at a right angle?', ['Shear lashing', 'Square lashing', 'Diagonal lashing', 'Round lashing'], 1, 'Square lashing holds poles that cross at 90°, like a camp table frame.'),
  mc('kn10', 'first', 'knots', 'Which lashing is used to make an A-frame or shear legs from two poles?', ['Shear lashing', 'Square lashing', 'Diagonal lashing', 'Clove lashing'], 0, 'Shear lashing binds two side-by-side poles that then spread into an A.'),
  mc('kn11', 'tenderfoot', 'knots', 'Why do you whip or fuse the end of a rope?', ['To make it stronger', 'To keep it from unraveling', 'To make it waterproof', 'To mark its length'], 1, 'Whipping (wrapping with twine) or fusing (melting synthetic rope) keeps the end from fraying.'),
  tf('kn12', 'first', 'knots', 'Fusing (melting) the end works on cotton and other natural-fiber ropes.', false, 'Only synthetic ropes like nylon melt. Natural fibers burn — whip those instead.'),
  { id: 'kn13', r: 'tenderfoot', t: 'knots', type: 'match', q: 'Match each knot to its job.', m: [['Square knot', 'Bandages, same-size ropes'], ['Taut-line hitch', 'Adjustable tent guyline'], ['Two half hitches', 'Rope around a post'], ['Bowline', 'Loop that won\'t slip'], ['Sheet bend', 'Ropes of different sizes']], why: 'Each knot has a job it does best. Using the right one keeps tents up and people safe.' },
  { id: 'kn14', r: 'first', t: 'knots', type: 'match', q: 'Match each lashing to what it builds.', m: [['Square lashing', 'Poles crossing at a right angle'], ['Diagonal lashing', 'Poles that cross at an angle and spring apart'], ['Shear lashing', 'An A-frame or bipod'], ['Clove hitch', 'Starts a square lashing']], why: 'Pioneering projects — tables, towers, bridges — combine all three lashings.' },
  { id: 'kn15', r: 'second', t: 'knots', type: 'scramble', q: 'Unscramble this rescue knot.', w: 'BOWLINE', hint: 'Fixed loop', why: 'The bowline makes a loop that won\'t tighten around someone.' },

  // ------------------------------------------------------------ First Aid
  mc('fa1', 'tenderfoot', 'firstaid', 'You arrive at an accident. What do you do first?', ['Run to the injured person', 'Check that the scene is safe', 'Give water', 'Move the person'], 1, 'Check, Call, Care: make sure the scene is safe for you before you help, so there aren\'t two victims.'),
  { id: 'fa2', r: 'tenderfoot', t: 'firstaid', type: 'order', q: 'Put the emergency steps in order.', o: ['Check the scene and the person', 'Call for help (911)', 'Care for the person'], why: 'Check, Call, Care — the scene and the person first, then get help coming, then give care.' },
  mc('fa3', 'tenderfoot', 'firstaid', 'What\'s the first thing to do for serious bleeding from a cut?', ['Put on a tourniquet', 'Press firmly on the wound with a clean cloth', 'Wash it in a stream', 'Raise the person\'s feet'], 1, 'Firm, steady direct pressure stops most bleeding. Wear gloves if you have them.'),
  mc('fa4', 'tenderfoot', 'firstaid', 'How should you treat a small, minor burn?', ['Put butter on it', 'Hold it under cool running water', 'Pop any blisters', 'Cover it with ice'], 1, 'Cool water for several minutes takes the heat out. Ice and butter can make it worse.'),
  mc('fa5', 'tenderfoot', 'firstaid', 'You feel a “hot spot” on your heel while hiking. What should you do?', ['Keep going until camp', 'Stop and cover it with moleskin or tape', 'Take your boots off and walk barefoot', 'Pop it'], 1, 'A hot spot is a blister about to form. Stopping early saves your feet.'),
  mc('fa6', 'second', 'firstaid', 'Pale, cool, sweaty skin, a headache and nausea on a hot day sound like…', ['Heat exhaustion', 'Hypothermia', 'Frostbite', 'Sunburn'], 0, 'Move them to shade, loosen clothing, cool them off and give sips of water.'),
  mc('fa7', 'second', 'firstaid', 'Hot skin, confusion, and possibly no sweating on a hot day are signs of…', ['Heat exhaustion', 'Heatstroke — a life-threatening emergency', 'Dehydration only', 'A cold'], 1, 'Heatstroke: call 911 and cool the person right away — wet them down and fan them.'),
  mc('fa8', 'second', 'firstaid', 'Shivering, stumbling and slurred words on a cold, wet day point to…', ['Hypothermia', 'Heatstroke', 'Altitude sickness', 'A sprain'], 0, 'Get them out of wind and rain, replace wet clothes with dry layers, and warm them up.'),
  tf('fa9', 'second', 'firstaid', 'You should rub frostbitten skin hard to warm it up.', false, 'Rubbing damages frozen tissue. Warm it gently, like holding fingers in an armpit or warm (not hot) water.'),
  mc('fa10', 'second', 'firstaid', 'What\'s the right first aid for a nosebleed?', ['Tilt the head back', 'Sit up, lean forward and pinch the soft part of the nose', 'Lie flat', 'Blow the nose hard'], 1, 'Leaning forward keeps blood from going down the throat. Pinch for about 10 minutes.'),
  mc('fa11', 'second', 'firstaid', 'Someone is bitten by a venomous snake. What should you do?', ['Cut the bite and suck out venom', 'Keep them calm and still and get medical help fast', 'Put ice on it', 'Tie a tight tourniquet'], 1, 'Cutting, sucking, ice and tourniquets all cause more harm. Keep them calm, remove rings or tight items, and get help.'),
  mc('fa12', 'second', 'firstaid', 'How should you remove a tick?', ['Burn it with a match', 'Smother it with petroleum jelly', 'Grip it close to the skin with tweezers and pull steadily', 'Twist it fast'], 2, 'Steady, even pressure with fine tweezers, then wash the area and your hands.'),
  mc('fa13', 'first', 'firstaid', 'For hands-only CPR on an adult, push hard and fast in the center of the chest at about…', ['30 pushes a minute', '60 pushes a minute', '100 to 120 pushes a minute', '200 pushes a minute'], 2, 'About the beat of “Stayin\' Alive.” Call 911 first or have someone else call.'),
  mc('fa14', 'first', 'firstaid', 'A person is clutching their throat and can\'t speak or cough. They\'re…', ['Having a heart attack', 'Choking', 'Fainting', 'Having an allergy'], 1, 'Hands at the throat is the universal choking sign. Give abdominal thrusts if you\'re trained.'),
  mc('fa15', 'second', 'firstaid', 'What does RICE stand for when treating a sprain?', ['Run, Ice, Carry, Elevate', 'Rest, Ice, Compression, Elevation', 'Rest, Immobilize, Clean, Exercise', 'Rub, Ice, Cover, Elevate'], 1, 'Rest it, ice it (wrapped), wrap it snugly, and raise it.'),
  mc('fa16', 'tenderfoot', 'firstaid', 'Dark yellow pee during a hike usually means…', ['You\'re well hydrated', 'You need to drink more water', 'You ate too much', 'Nothing'], 1, 'Pale yellow means you\'re drinking enough. Dark yellow means drink up.'),
  { id: 'fa17', r: 'tenderfoot', t: 'firstaid', type: 'match', q: 'Match the problem to the first aid.', m: [['Minor burn', 'Cool running water'], ['Heavy bleeding', 'Firm direct pressure'], ['Blister “hot spot”', 'Stop and pad it'], ['Nosebleed', 'Lean forward and pinch'], ['Tick', 'Tweezers, pull steadily']], why: 'Knowing the right first move for common problems makes you the Scout people count on.' },

  // ------------------------------------------------------------ Camping & Fire
  mc('ca1', 'scout', 'camping', 'Why do Scouts use the buddy system?', ['To share gear', 'So someone always knows where you are and can help', 'To make patrols bigger', 'To carry less'], 1, 'Buddies keep each other safe — on the trail, in the water and around camp.'),
  mc('ca2', 'tenderfoot', 'camping', 'Which is the best place to pitch a tent?', ['At the bottom of a gully', 'Under a big dead branch', 'On flat, high ground with good drainage', 'Right next to the lake'], 2, 'Avoid low spots that flood and “widowmaker” dead branches overhead.'),
  mc('ca3', 'tenderfoot', 'camping', 'Which fabric is the worst choice for staying warm when it gets wet?', ['Wool', 'Fleece', 'Cotton', 'Polyester'], 2, 'Wet cotton loses its insulation and pulls heat from your body — “cotton kills” in cold weather.'),
  { id: 'ca4', r: 'tenderfoot', t: 'camping', type: 'order', q: 'Put the clothing layers in order, from your skin out.', o: ['Wicking base layer', 'Insulating middle layer (fleece or wool)', 'Wind and rain shell'], why: 'Layers let you adjust as you warm up or cool down, and keep you dry.' },
  mc('ca5', 'tenderfoot', 'camping', 'Which of these is one of the Scout Basic Essentials?', ['Video game', 'Map and compass', 'Pillow', 'Cooler'], 1, 'The Essentials: pocketknife, first-aid kit, extra clothes, rain gear, water bottle, flashlight, trail food, matches and fire starters, sun protection, and map and compass.'),
  mc('ca6', 'tenderfoot', 'camping', 'Why do you put a pad under your sleeping bag?', ['Only for comfort', 'The cold ground pulls heat out of you', 'To keep the bag clean', 'It\'s required'], 1, 'A pad insulates you from the ground — often more important than a warmer bag.'),
  mc('ca7', 'tenderfoot', 'camping', 'Where should food and scented items go at night in bear or raccoon country?', ['In your tent', 'In a bear bag, canister or locked vehicle', 'Under the picnic table', 'In your pack by your head'], 1, 'Never keep food, toothpaste or snacks in your tent.'),
  mc('ca8', 'second', 'camping', 'What three things does a fire need?', ['Wood, paper, matches', 'Heat, fuel and oxygen', 'Tinder, rocks, water', 'Sun, wind, rain'], 1, 'Take away any side of the fire triangle and the fire goes out.'),
  { id: 'ca9', r: 'second', t: 'camping', type: 'order', q: 'Put the fire materials in the order you add them.', o: ['Tinder', 'Kindling', 'Fuel wood'], why: 'Tinder catches the spark, kindling grows the flame, and fuel wood keeps it going.' },
  mc('ca10', 'second', 'camping', 'How do you know a campfire is truly out?', ['The flames are gone', 'Drown it, stir it and feel it — it\'s cold to the touch', 'It stopped smoking', 'You covered it with dirt'], 1, 'If it\'s too hot to touch, it\'s too hot to leave.'),
  mc('ca11', 'scout', 'camping', 'What does the Totin\' Chip show?', ['You can cook', 'You know how to safely use a knife, saw and axe', 'You can swim', 'You finished a hike'], 1, 'The Totin\' Chip is the privilege to carry and use woods tools.'),
  mc('ca12', 'second', 'camping', 'What does the Firem\'n Chit show?', ['You know fire safety and can build and put out a fire properly', 'You can use a camp stove', 'You know first aid', 'You can carry matches anywhere'], 0, 'The Firem\'n Chit gives you the privilege to build campfires.'),
  mc('ca13', 'scout', 'camping', 'How should you hand a pocketknife to someone?', ['Open, blade first', 'Closed, or handle first so they say “thank you” as they take it', 'Toss it to them', 'Stick it in a log for them'], 1, 'Close it first. If it can\'t close, offer the handle and let go only when they have it.'),
  mc('ca14', 'scout', 'camping', 'What\'s a “blood circle”?', ['A first aid term', 'The area within reach of your arm plus your tool — keep everyone out of it', 'A campfire ring', 'A patrol game'], 1, 'Before using a knife, saw or axe, check that no one is in your blood circle.'),
  tf('ca15', 'tenderfoot', 'camping', 'It\'s OK to run a camp stove inside a closed tent to warm up.', false, 'Stoves in tents risk fire and deadly carbon monoxide. Cook outside.'),
  mc('ca16', 'second', 'camping', 'To make water safe by boiling, bring it to a rolling boil for at least…', ['5 seconds', '1 minute (3 minutes at high elevation)', '15 minutes', 'Until it steams'], 1, 'A one-minute rolling boil kills germs; above 6,500 feet, boil for 3 minutes.'),
  { id: 'ca17', r: 'tenderfoot', t: 'camping', type: 'scramble', q: 'Unscramble this piece of tent gear.', w: 'GUYLINE', hint: 'Holds a tent tight', why: 'Guylines and stakes keep your tent standing in wind and rain.' },

  // ------------------------------------------------------------ Cooking
  mc('co1', 'tenderfoot', 'cooking', 'Chicken is safe to eat when it reaches an internal temperature of…', ['120°F', '145°F', '165°F', '212°F'], 2, 'Use a food thermometer: chicken 165°F, ground beef 160°F.'),
  mc('co2', 'tenderfoot', 'cooking', 'Cold foods like meat and milk should be kept at or below…', ['40°F', '60°F', '72°F', '100°F'], 0, 'Between 40°F and 140°F is the “danger zone” where germs grow fast.'),
  mc('co3', 'tenderfoot', 'cooking', 'Why use a separate cutting board for raw meat?', ['It\'s faster', 'To avoid spreading germs to food that won\'t be cooked', 'To keep knives sharp', 'Raw meat is heavier'], 1, 'Cross-contamination is one of the main causes of food sickness at camp.'),
  { id: 'co4', r: 'tenderfoot', t: 'cooking', type: 'order', q: 'Put the patrol dishwashing pots in order.', o: ['Hot soapy wash water', 'Hot rinse water', 'Sanitizing rinse'], why: 'Wash, rinse, sanitize — then air-dry on a clean surface.' },
  mc('co5', 'second', 'cooking', 'When baking in a Dutch oven, where should most of the coals go?', ['All underneath', 'Mostly on the lid', 'Split evenly', 'Around the sides only'], 1, 'Baking needs top heat: roughly two-thirds on the lid and one-third underneath.'),
  mc('co6', 'tenderfoot', 'cooking', 'On a MyPlate, about how much of your plate should be fruits and vegetables?', ['A quarter', 'Half', 'Three-quarters', 'None'], 1, 'Fill half the plate with fruits and veggies, then add grains and protein.'),
  tf('co7', 'tenderfoot', 'cooking', 'Wash your hands before handling food and after using the latrine.', true, 'Clean hands keep the whole patrol from getting sick.'),
  mc('co8', 'second', 'cooking', 'What should you do with leftover dishwater at camp?', ['Pour it in the lake', 'Strain out food bits, then scatter it far from water', 'Dump it by the tents', 'Leave it in the pot'], 1, 'Pack out the food scraps and scatter strained gray water at least 200 feet from lakes and streams.'),

  // ------------------------------------------------------------ Map & Compass
  mc('nv1', 'second', 'nav', 'On a topographic map, what does the color green show?', ['Water', 'Vegetation like woods', 'Roads', 'Elevation lines'], 1, 'Green = vegetation, blue = water, brown = contour lines, black = man-made features.'),
  mc('nv2', 'second', 'nav', 'Brown lines on a topo map are…', ['Trails', 'Contour lines showing elevation', 'Rivers', 'Property lines'], 1, 'Each contour line connects points at the same height.'),
  mc('nv3', 'second', 'nav', 'Contour lines that are very close together mean the land is…', ['Flat', 'Steep', 'Wet', 'Wooded'], 1, 'Close lines = steep; far apart = gentle.'),
  mc('nv4', 'second', 'nav', 'The red end of a compass needle points to…', ['True north', 'Magnetic north', 'The North Star', 'Your destination'], 1, 'Compasses point to magnetic north, which is a little different from true north.'),
  mc('nv5', 'first', 'nav', 'The difference between true north and magnetic north is called…', ['Declination', 'Deviation', 'Bearing', 'Azimuth'], 0, 'You adjust for declination to match your compass to the map.'),
  mc('nv6', 'second', 'nav', 'What compass bearing is due east?', ['0°', '90°', '180°', '270°'], 1, 'North 0°, east 90°, south 180°, west 270°.'),
  { id: 'nv7', r: 'second', t: 'nav', type: 'match', q: 'Match the topo map color to what it shows.', m: [['Green', 'Woods and vegetation'], ['Blue', 'Water'], ['Brown', 'Contour lines'], ['Black', 'Buildings and man-made features']], why: 'Reading colors lets you picture the land before you ever see it.' },
  mc('nv8', 'first', 'nav', 'On a 1:24,000 map, 1 inch on the map equals…', ['1 mile', '2,000 feet', '24 miles', '100 yards'], 1, '24,000 inches is 2,000 feet — about four-tenths of a mile.'),
  mc('nv9', 'second', 'nav', 'You realize you\'re lost. What should you do first?', ['Run until you find the trail', 'STOP: Stop, Think, Observe, Plan', 'Climb a tree', 'Split up to search'], 1, 'Stay calm and stay put if you\'re truly lost — it\'s easier for searchers to find you.'),
  mc('nv10', 'second', 'nav', 'What\'s the universal distress signal with a whistle?', ['One long blast', 'Two short blasts', 'Three blasts', 'Ten quick blasts'], 2, 'Three of anything — blasts, flashes, fires — means “help.”'),
  mc('nv11', 'scout', 'nav', 'The sun rises in the…', ['North', 'South', 'East', 'West'], 2, 'East in the morning, west in the evening — a handy backup when you don\'t have a compass.'),
  mc('nv12', 'first', 'nav', 'To orient a map, you…', ['Hold it upside down', 'Turn it so the map\'s north lines up with north on your compass', 'Fold it in half', 'Point it at the sun'], 1, 'An oriented map matches the land in front of you.'),

  // ------------------------------------------------------------ Nature & Weather
  mc('na1', 'tenderfoot', 'nature', '“Leaves of three, let it be” warns you about…', ['Oak trees', 'Poison ivy', 'Clover', 'Ferns'], 1, 'Poison ivy has three leaflets. If you touch it, wash with soap and water soon.'),
  mc('na2', 'first', 'nature', 'Poison sumac usually grows…', ['In deserts', 'In wet, swampy areas', 'On mountain tops', 'Only in yards'], 1, 'Poison sumac has 7 to 13 leaflets per stem and likes wet ground.'),
  mc('na3', 'first', 'nature', 'Which of these Florida snakes is venomous?', ['Black racer', 'Rat snake', 'Cottonmouth', 'Garter snake'], 2, 'Cottonmouths (water moccasins) are venomous. Give every snake plenty of space.'),
  mc('na4', 'second', 'nature', 'You see lightning and count 15 seconds until thunder. About how far away is the storm?', ['1 mile', '3 miles', '15 miles', 'It\'s overhead'], 1, 'Divide the seconds by 5 for miles. If you can hear thunder, you\'re close enough to be struck.'),
  mc('na5', 'second', 'nature', 'After the last thunder, how long should you wait before going back outside?', ['1 minute', '5 minutes', '30 minutes', 'No need to wait'], 2, 'Wait 30 minutes after the last thunder. When thunder roars, go indoors.'),
  mc('na6', 'second', 'nature', 'Caught outside in a thunderstorm, you should avoid…', ['Low ground', 'Hilltops, open fields and lone tall trees', 'Thick forest of small trees', 'Crouching down'], 1, 'Lightning hits the tallest things. Get to a building or car if you can.'),
  mc('na7', 'second', 'nature', 'A tall, towering cloud with a flat, anvil-shaped top is a…', ['Cirrus', 'Stratus', 'Cumulonimbus', 'Fog'], 2, 'Cumulonimbus clouds bring thunderstorms.'),
  mc('na8', 'tenderfoot', 'nature', 'A tree that drops its leaves every fall is…', ['Evergreen', 'Deciduous', 'Coniferous', 'Tropical'], 1, 'Deciduous trees like oaks and maples lose leaves in fall; evergreens like pines keep them.'),
  mc('na9', 'second', 'nature', 'A split, heart-shaped hoof print on the trail most likely came from a…', ['Raccoon', 'Deer', 'Bear', 'Fox'], 1, 'Deer leave two-toed, heart-shaped tracks.'),
  tf('na10', 'tenderfoot', 'nature', 'Checking for ticks after a hike helps prevent tick-borne illness.', true, 'Check scalp, behind ears, armpits and waistband. Insect repellent helps too.'),

  // ------------------------------------------------------------ Leave No Trace
  { id: 'ln1', r: 'second', t: 'lnt', type: 'order', q: 'Put the seven Leave No Trace principles in order.', o: ['Plan ahead and prepare', 'Travel and camp on durable surfaces', 'Dispose of waste properly', 'Leave what you find', 'Minimize campfire impacts', 'Respect wildlife', 'Be considerate of other visitors'], why: 'These seven principles help keep the outdoors wild for everyone after you.' },
  mc('ln2', 'second', 'lnt', 'How deep should a cathole be?', ['1 to 2 inches', '6 to 8 inches', '2 feet', 'As deep as possible'], 1, 'Dig 6 to 8 inches deep and at least 200 feet from water, camp and trails.'),
  mc('ln3', 'second', 'lnt', 'How far should you camp from lakes and streams?', ['10 feet', '50 feet', 'At least 200 feet', 'It doesn\'t matter'], 2, 'About 70 big steps protects the water and the animals that use it.'),
  mc('ln4', 'second', 'lnt', 'Which is a durable surface to camp or walk on?', ['Meadow flowers', 'Rock, gravel or an established campsite', 'Moss', 'Wet mud next to a stream'], 1, 'Durable surfaces don\'t get damaged by feet and tents.'),
  tf('ln5', 'second', 'lnt', 'It\'s kind to feed squirrels and birds at camp.', false, 'Human food harms wildlife and teaches them to raid camps. Watch from a distance.'),
  mc('ln6', 'second', 'lnt', '“Pack it in, pack it out” is about which principle?', ['Respect wildlife', 'Dispose of waste properly', 'Plan ahead', 'Leave what you find'], 1, 'Everything you bring in — including trash and food scraps — goes home with you.'),
  { id: 'ln7', r: 'second', t: 'lnt', type: 'match', q: 'Match the action to the Leave No Trace principle.', m: [['Checking the weather before the trip', 'Plan ahead and prepare'], ['Taking a photo of a cool rock instead of keeping it', 'Leave what you find'], ['Using an existing fire ring', 'Minimize campfire impacts'], ['Keeping your music down', 'Be considerate of other visitors']], why: 'Leave No Trace is about choices you make every day outdoors.' },

  // ------------------------------------------------------------ Safety & Swimming
  { id: 'sa1', r: 'second', t: 'safety', type: 'order', q: 'Put the water rescue methods in order, safest first.', o: ['Reach', 'Throw', 'Row', 'Go (only if trained)'], why: 'Reach with a pole, throw a float, row a boat out — only trained rescuers should go into the water.' },
  mc('sa2', 'first', 'safety', 'In the swimmer test, after jumping in over your head, you swim 75 yards with a strong stroke and then…', ['Tread water 5 minutes', 'Swim 25 yards of easy resting backstroke, then float', 'Dive to the bottom', 'Climb out'], 1, 'The 100 yards is one swim without stopping, with at least one sharp turn, followed by floating to rest.'),
  mc('sa3', 'second', 'safety', 'What are the three swimming ability groups?', ['Red, white, blue', 'Nonswimmer, beginner, swimmer', 'Junior, senior, expert', 'Shallow, medium, deep'], 1, 'Each group swims only in the area that matches its skill.'),
  mc('sa4', 'second', 'safety', 'During a buddy check at the swimming area, buddies…', ['Race each other', 'Join hands, raise them and stay together', 'Get out of the water', 'Count to ten'], 1, 'Buddy checks make sure everyone is accounted for, fast.'),
  tf('sa5', 'second', 'safety', 'Everyone in a canoe or kayak should wear a properly fitted life jacket (PFD).', true, 'Safety Afloat: PFDs on, always, when boating.'),
  mc('sa6', 'scout', 'safety', 'What are the “three R\'s” of youth protection?', ['Read, Write, Repeat', 'Recognize, Resist, Report', 'Run, Rest, Return', 'Respect, Remember, Reply'], 1, 'Recognize when something isn\'t right, resist it, and report it to a trusted adult.'),
  mc('sa7', 'scout', 'safety', 'Two-deep leadership means…', ['Two patrols together', 'At least two registered adult leaders at every Scouting activity', 'Two Scouts per tent', 'Two leaders per merit badge'], 1, 'No adult is ever alone with a Scout who isn\'t their own child — online too.'),
  mc('sa8', 'scout', 'safety', 'Someone you only know online asks for your address. You should…', ['Send it', 'Not share it and tell a parent or leader', 'Give a fake one', 'Ask them why'], 1, 'Keep personal info private online and tell a trusted adult.'),
  mc('sa9', 'tenderfoot', 'safety', 'If you\'re bullied, the best step is to…', ['Keep it secret', 'Get back at them', 'Tell a trusted adult', 'Quit Scouts'], 2, 'Scouts and leaders take bullying seriously — telling someone is brave, not snitching.'),

  // ------------------------------------------------------------ Citizenship & Flag
  mc('ci1', 'tenderfoot', 'citizen', 'How many stripes are on the U.S. flag?', ['10', '13', '50', '7'], 1, 'Thirteen stripes for the thirteen original colonies; fifty stars for the states.'),
  mc('ci2', 'tenderfoot', 'citizen', 'Folded correctly, the U.S. flag ends up as…', ['A square', 'A triangle with only the blue field showing', 'A roll', 'A rectangle'], 1, 'Fold it lengthwise twice, then in triangles from the striped end until only the blue field with stars shows.'),
  tf('ci3', 'tenderfoot', 'citizen', 'The U.S. flag should never touch the ground.', true, 'Handle it with respect — keep it off the ground when raising, lowering and folding.'),
  mc('ci4', 'second', 'citizen', 'Before lowering a flag to half-staff, you first…', ['Fold it', 'Raise it to the top for an instant', 'Salute twice', 'Lower it to the ground'], 1, 'Raise to the peak, then lower to half-staff. At day\'s end, raise to the peak before lowering.'),
  tf('ci5', 'second', 'citizen', 'If the flag is flown at night, it should be lit up.', true, 'The Flag Code says a flag displayed at night should be properly illuminated.'),
  mc('ci6', 'second', 'citizen', 'What\'s the respectful way to retire a worn-out flag?', ['Throw it away', 'A dignified ceremony, usually by burning', 'Use it as a rag', 'Bury it in the yard'], 1, 'Many troops hold flag retirement ceremonies — a great Good Turn.'),
  mc('ci7', 'star', 'citizen', 'How many branches does the U.S. government have?', ['Two', 'Three', 'Four', 'Five'], 1, 'Legislative (Congress), executive (President) and judicial (courts).'),
  mc('ci8', 'star', 'citizen', 'The first ten amendments to the Constitution are called…', ['The Declaration', 'The Bill of Rights', 'The Preamble', 'The Articles'], 1, 'They protect rights like free speech, religion and a fair trial.'),
  mc('ci9', 'star', 'citizen', 'At what age can U.S. citizens vote?', ['16', '18', '21', '25'], 1, 'The 26th Amendment set the voting age at 18.'),
  mc('ci10', 'tenderfoot', 'citizen', 'Who wrote the words to “The Star-Spangled Banner”?', ['George Washington', 'Francis Scott Key', 'Betsy Ross', 'Abraham Lincoln'], 1, 'Key wrote it in 1814 after watching the bombardment of Fort McHenry.'),
  { id: 'ci11', r: 'star', t: 'citizen', type: 'match', q: 'Match each branch of government to who leads it.', m: [['Legislative', 'Congress'], ['Executive', 'The President'], ['Judicial', 'The Supreme Court']], why: 'Checks and balances keep any one branch from having too much power.' },

  // ------------------------------------------------------------ Patrol & Leadership
  mc('le1', 'scout', 'leader', 'Who runs the troop day to day and leads the Patrol Leaders\' Council?', ['The Scoutmaster', 'The Senior Patrol Leader', 'The Committee Chair', 'The oldest Scout'], 1, 'The SPL is a Scout elected by the troop; the Scoutmaster coaches and supports.'),
  mc('le2', 'scout', 'leader', 'The patrol method means…', ['Adults plan everything', 'Scouts work together in small groups and lead themselves', 'Patrols compete only', 'Everyone camps alone'], 1, 'Patrols are small teams where Scouts learn to lead and help each other.'),
  mc('le3', 'first', 'leader', 'What does EDGE stand for when teaching a skill?', ['Easy, Done, Good, Ended', 'Explain, Demonstrate, Guide, Enable', 'Educate, Direct, Grade, Evaluate', 'Every Day Gets Easier'], 1, 'Explain it, show it, coach them through it, then let them do it on their own.'),
  { id: 'le4', r: 'star', t: 'leader', type: 'match', q: 'Match the troop position to its job.', m: [['Quartermaster', 'Keeps track of troop gear'], ['Scribe', 'Keeps records and minutes'], ['Troop Guide', 'Helps new Scouts'], ['Den Chief', 'Helps a Cub Scout den'], ['Patrol Leader', 'Leads a patrol']], why: 'Positions of responsibility are part of Star, Life and Eagle.' },
  mc('le5', 'star', 'leader', 'Who plans the troop\'s program and calendar?', ['The parents', 'The Patrol Leaders\' Council', 'The chartered organization', 'The council office'], 1, 'The PLC — the SPL, patrol leaders and others — plans what the troop does.'),
  mc('le6', 'first', 'leader', 'After an activity, a quick “Start, Stop, Continue” talk helps the patrol…', ['Pick teams', 'Reflect on what to start, stop and keep doing', 'Clean up faster', 'Choose a yell'], 1, 'Reflection helps leaders and patrols get better every time.'),

  // ------------------------------------------------------------ Trail to Eagle
  { id: 'ad1', r: 'scout', t: 'advance', type: 'order', q: 'Put the Scouts BSA ranks in order.', o: ['Scout', 'Tenderfoot', 'Second Class', 'First Class', 'Star', 'Life', 'Eagle'], why: 'Seven ranks from Scout to Eagle.' },
  mc('ad2', 'star', 'advance', 'How many merit badges does Star rank need?', ['3', '6', '11', '21'], 1, 'Star: 6 merit badges, 4 of them from the Eagle-required list.'),
  mc('ad3', 'star', 'advance', 'How many merit badges in all does Life rank need?', ['6', '11', '15', '21'], 1, 'Life: 11 in all, including 7 from the Eagle-required list.'),
  mc('ad4', 'star', 'advance', 'How many merit badges does Eagle need?', ['13', '18', '21', '30'], 2, 'Eagle: 21, including all 13 Eagle-required badges (Citizenship in Society was retired in February 2026).'),
  mc('ad5', 'star', 'advance', 'An Eagle Scout service project must benefit…', ['The Scout\'s own troop', 'A school, religious group or community — not Scouting itself', 'A business', 'The Scout\'s family'], 1, 'The project shows leadership by planning and leading others to help the community.'),
  mc('ad6', 'star', 'advance', 'Eagle requirements must be finished before the Scout\'s…', ['16th birthday', '18th birthday', '21st birthday', 'High school graduation'], 1, 'All Eagle requirements must be done before turning 18.'),
  mc('ad7', 'tenderfoot', 'advance', 'After finishing a rank\'s requirements, a Scout has a Scoutmaster conference and then a…', ['Court of Honor', 'Board of review', 'Merit badge class', 'Campout'], 1, 'The board of review is a friendly chat with committee members about your progress.'),
  mc('ad8', 'second', 'advance', 'Before starting a merit badge, a Scout should…', ['Just start working on it', 'Talk with the Scoutmaster and get a merit badge counselor', 'Buy the patch', 'Ask a friend to sign'], 1, 'Your Scoutmaster helps you find a registered counselor for the badge.'),
  mc('ad9', 'star', 'advance', 'Which of these is an Eagle-required merit badge?', ['Fishing', 'First Aid', 'Chess', 'Robotics'], 1, 'First Aid is Eagle-required, along with Camping, Cooking, the Citizenship badges and more.'),
  { id: 'ad10', r: 'star', t: 'advance', type: 'scramble', q: 'Unscramble the highest rank.', w: 'EAGLE', hint: 'A bird of prey', why: 'Only a small share of Scouts earn Eagle — it\'s a big deal!' },
  tf('ad11', 'scout', 'advance', 'Earning ranks is about learning skills and growing as a person, not just collecting patches.', true, 'Each rank builds skills and character — the patch is the reminder.'),
];

export const byId = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
export const LEVELS = [
  { xp: 0, name: 'Camp Rookie' }, { xp: 300, name: 'Trail Walker' }, { xp: 900, name: 'Pathfinder' }, { xp: 2000, name: 'Ridge Runner' },
  { xp: 3500, name: 'Summit Seeker' }, { xp: 6000, name: 'Eagle Eye' }, { xp: 10000, name: 'Legend of the Trail' },
];
export const BADGES = [
  { id: 'first-game', emoji: '🎯', name: 'First Steps', desc: 'Finish your first game' },
  { id: 'perfect', emoji: '💯', name: 'Perfect Round', desc: 'Get every question right in a Quiz Trail' },
  { id: 'streak5', emoji: '🔥', name: 'On Fire', desc: '5 right answers in a row' },
  { id: 'daily3', emoji: '📅', name: 'Daily Habit', desc: 'Do the Daily Challenge 3 days in a row' },
  { id: 'law', emoji: '⚜️', name: 'Law Keeper', desc: 'Put the Scout Law in order' },
  { id: 'knots', emoji: '🪢', name: 'Knot Master', desc: '20 knot questions right' },
  { id: 'firstaid', emoji: '⛑️', name: 'First Responder', desc: '20 first aid questions right' },
  { id: 'all-topics', emoji: '🧭', name: 'Explorer', desc: 'Play every topic' },
  { id: 'live-win', emoji: '🏆', name: 'Campfire Champ', desc: 'Win a Campfire Clash' },
  { id: 'speed20', emoji: '⚡', name: 'Lightning Fast', desc: '20+ right in a Speed Round' },
];

// is this answer right? Answers use the bank's own order (never the shuffled one):
// mc = index in c, tf = true/false, order/match = original indices in the chosen order, scramble = the word
export function isRight(q, a) {
  if (!q) return false;
  if (q.type === 'mc') return Number(a) === q.a;
  if (q.type === 'tf') return a === q.a || a === String(q.a);
  if (q.type === 'order') return Array.isArray(a) && a.length === q.o.length && a.every((x, i) => Number(x) === i);
  if (q.type === 'match') return Array.isArray(a) && a.length === q.m.length && a.every((x, i) => Number(x) === i);
  if (q.type === 'scramble') return String(a || '').toUpperCase().replace(/[^A-Z]/g, '') === q.w;
  return false;
}
