// Florida outdoor hazards field guide (works offline). Plain-language safety basics for scouts;
// it doesn't replace first aid training. In an emergency, call 911.
export const POISON_CONTROL = '1-800-222-1222';
// Numbers checked October 2026: Poison Control (America's Poison Centers, for bites, stings, plants and repellent),
// FWC Nuisance Alligator Hotline (myfwc.com), FWC Wildlife Alert (myfwc.com bear contacts).
export const CALLS = {
  poison: { label: 'Poison Control', phone: POISON_CONTROL, emoji: '☠️' },
  gator: { label: 'FWC alligator hotline', phone: '866-392-4286', emoji: '🐊' },
  fwc: { label: 'FWC Wildlife Alert', phone: '888-404-3922', emoji: '🐻' },
};

export const GUIDE = [
  { id: 'snakes', calls: ['poison'], emoji: '🐍', title: 'Venomous snakes', short: 'Six kinds live in Florida. Leave every snake alone.',
    sections: [
      ['The six to know', ['Eastern diamondback rattlesnake: big, heavy, with dark diamonds outlined in cream.', 'Timber (canebrake) rattlesnake: dark crossbands, often a rusty stripe down the back.', 'Pigmy rattlesnake: small and gray with dark spots; the rattle is tiny and hard to hear.', 'Cottonmouth (water moccasin): thick, dark body near water; may gape to show a white mouth.', 'Copperhead: tan with hourglass bands; in north Florida and the Panhandle.', 'Eastern coral snake: red, yellow and black bands, with red touching yellow. Shy, but very venomous.']],
      ['Stay safe', ['Watch where you put your hands and feet. Step onto logs, not over them.', 'Use a flashlight at night.', 'Never touch, pick up or tease a snake, even one that looks dead.', 'Give a snake plenty of room and walk around it.']],
      ['If someone is bitten', ['Move away from the snake. Don\'t try to catch or kill it; a photo from far away is fine.', 'Call 911. Keep the person calm and still. Poison Control can also advise while you wait.', 'Keep the bitten arm or leg still, at or below the level of the heart.', 'Take off rings, watches and tight clothing near the bite before it swells.', 'Do NOT cut the bite, suck it, put ice on it, or use a tourniquet.']],
    ] },
  { id: 'gators', calls: ['gator'], emoji: '🐊', title: 'Alligators', short: 'Found in almost any Florida freshwater. Give them space.',
    sections: [
      ['Stay safe', ['Assume any lake, river, pond or swamp could have an alligator.', 'Swim only in marked swimming areas, in daylight, with your buddy and a lifeguard or leader watching.', 'Stay back from the water\'s edge, especially at dusk and after dark when gators are most active.', 'Never feed an alligator. It\'s dangerous and against Florida law.', 'Keep a long distance from any alligator. If one hisses or comes toward you, back away.']],
      ['If one won\'t leave', ['If an alligator comes into camp or a swim area and won\'t leave, move everyone away and tell a leader.', 'Leaders call the park ranger or FWC\'s Nuisance Alligator Hotline. Never try to move or catch it.', 'If someone is bitten, call 911.']],
    ] },
  { id: 'lightning', calls: [], emoji: '⚡', title: 'Lightning', short: 'Florida has some of the most lightning in the U.S. When thunder roars, go indoors.',
    sections: [
      ['The rules', ['If you can hear thunder, you\'re close enough to be struck.', 'Get inside a real building or a hard-topped car. Tents, picnic shelters and dining flies do NOT protect you.', 'Get out of the water and off boats right away.', 'Wait 30 minutes after the last thunder before going back out.']],
      ['Caught outside?', ['Get off hilltops, open fields, beaches and the water.', 'Stay away from tall single trees, flagpoles and metal fences.', 'Spread the group out so one strike can\'t hit everyone.', 'Someone struck by lightning is safe to touch. Call 911 and start CPR if they aren\'t breathing.']],
    ] },
  { id: 'heat', calls: [], emoji: '🥵', title: 'Heat', short: 'Heat illness can sneak up on a hike. Drink before you\'re thirsty.',
    sections: [
      ['Prevent it', ['Drink water often, before, during and after activity.', 'Plan hard work and hikes for the cooler morning.', 'Wear a hat and light, loose clothing. Take breaks in the shade.', 'Watch your buddy: people often don\'t notice heat illness in themselves.']],
      ['Heat exhaustion', ['Signs: heavy sweating, cool clammy skin, headache, dizziness, nausea, weakness.', 'Move to shade, loosen clothes, cool with wet cloths and sip water.', 'Get medical help if it gets worse, lasts more than an hour, or the person vomits.']],
      ['Heat stroke (an emergency)', ['Signs: very hot skin, confusion, strange behavior, passing out. Sweating may stop.', 'Call 911.', 'Cool the person fast: shade, cool water if you can (a tub or stream), wet clothes, cold packs at the neck, armpits and groin.', 'Do NOT give them anything to drink.']],
    ] },
  { id: 'plants', calls: ['poison'], emoji: '🍃', title: 'Poison ivy, oak and sumac', short: 'Leaves of three, let it be. Poison sumac has 7 to 13.',
    sections: [
      ['Know them', ['Poison ivy: three leaflets; grows as a vine, a ground cover or a shrub. Common all over Florida.', 'Poison oak: three leaflets shaped like oak leaves; dry, sandy woods.', 'Poison sumac: 7 to 13 leaflets on red stems; wet, swampy places.']],
      ['If you touch it', ['Wash the skin with soap and cool water as soon as you can.', 'Wash clothes, boots and gear that touched it; the oil stays on them.', 'Don\'t scratch. Calamine or anti-itch cream helps.', 'Never burn these plants. The smoke can hurt your lungs.', 'Get help for a rash on the face or eyes, or trouble breathing.']],
    ] },
  { id: 'ants', calls: ['poison'], emoji: '🐜', title: 'Fire ants, bees and wasps', short: 'Look before you sit or set down a pack.',
    sections: [
      ['Fire ants', ['Watch for fluffy dirt mounds, especially in sunny grass. Don\'t camp or sit on them.', 'If they get on you, brush them off fast and move away from the mound.', 'Stings turn into itchy white bumps. Keep them clean and don\'t pop them.']],
      ['Bees and wasps', ['Scrape a stinger out with a fingernail or card. Wash and cool the spot.']],
      ['Allergic reaction to any sting', ['Fire ants, bees and wasps can all cause one. Watch for swelling of the face or throat, trouble breathing, or hives all over.', 'Use the person\'s own epinephrine if they have it and call 911.']],
    ] },
  { id: 'bugs', calls: ['poison'], emoji: '🦟', title: 'Ticks, mosquitoes and caterpillars', short: 'Bug spray, long sleeves and a tick check every night.',
    sections: [
      ['Ticks', ['Use repellent, wear long pants tucked into socks in tall grass and brush, and stay on trails.', 'Check yourself every evening: hairline, behind ears, armpits, waistband, behind knees.', 'To remove one, grab it close to the skin with fine tweezers and pull straight out. Wash the spot.', 'Tell a leader about a rash or fever in the next few weeks.']],
      ['Mosquitoes', ['Use repellent with DEET or picaridin, and wear long sleeves around dawn and dusk.']],
      ['Stinging caterpillars', ['Some fuzzy caterpillars (like the puss caterpillar) and spiky ones (like the saddleback) sting hard. Don\'t touch them.', 'If stung, press tape on the spot and pull it off to remove the spines, then wash.']],
    ] },
  { id: 'bears', calls: ['fwc'], emoji: '🐻', title: 'Black bears', short: 'Florida black bears live in the Apalachicola National Forest and other big woods.',
    sections: [
      ['At camp', ['Keep a clean camp. Never keep food, snacks, toothpaste or anything with a smell in a tent.', 'Store food in a bear bag hung high between trees, a bear box, or a locked car.', 'Cook and eat away from where you sleep. Pack out all trash.']],
      ['If you see one', ['Stay calm and give it space. Never run.', 'Stand tall with your group, talk in a loud firm voice, and back away slowly.', 'Never feed a bear or leave food out.', 'Don\'t play dead or climb a tree. If a black bear attacks, fight back.']],
      ['Report a problem', ['If a bear gets into food or trash or won\'t leave camp, leaders tell the park ranger or call FWC Wildlife Alert.', 'If anyone is hurt, call 911.']],
    ] },
  { id: 'water', calls: [], emoji: '🌊', title: 'Water and rip currents', short: 'Swim only with a buddy and a lifeguard or leader watching.',
    sections: [
      ['Safe swimming', ['Swim in marked areas with the buddy system and a buddy board.', 'Wear a life jacket in boats, canoes and kayaks, every time.', 'Springs and rivers can have cold water and strong current.']],
      ['Rip currents at the beach', ['A rip current pulls you away from shore. Don\'t fight it.', 'Stay calm, float, and swim parallel to the shore until you\'re out of it, then swim in.', 'If you can\'t, face the shore, wave and yell for help.', 'Don\'t swim out to save someone. Throw them something that floats and get a lifeguard.']],
    ] },
];
