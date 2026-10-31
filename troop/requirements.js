// Scout through First Class requirements (Scouts BSA, 2024), as short summaries in Basecamp's own
// words. The official text is in the Scouts BSA Handbook and at scouting.org; check it before signing.
// lead: only an adult leader can sign it (conferences, boards of review).
const R = (id, text, lead) => ({ id, text, lead: !!lead });

export const REQS = {
  Scout: [
    R('1a', 'Recite the Scout Oath, Law, motto and slogan and explain them'), R('1b', 'Explain Scout spirit with examples of living it'),
    R('1c', 'Show the Scout sign, salute and handshake and when to use them'), R('1d', 'Describe the First Class badge and what its parts mean'),
    R('1e', 'Recite the Outdoor Code, list the Leave No Trace principles and compare them'), R('1f', 'Recite the Pledge of Allegiance and explain it'),
    R('2a', 'Describe how scouts lead the troop'), R('2b', 'Describe the four steps of advancement'), R('2c', 'Describe the ranks and how they are earned'), R('2d', 'Describe merit badges and how they are earned'),
    R('3a', 'Explain the patrol method and the troop\'s patrols'), R('3b', 'Know your patrol\'s name, emblem, flag and yell'),
    R('4a', 'Tie the square knot, two half hitches and taut-line hitch and explain their uses'), R('4b', 'Whip and fuse rope ends'),
    R('5', 'Explain pocketknife safety and responsibility'), R('6', 'With a parent, complete the youth protection exercises in the handbook', true),
    R('7', 'Scoutmaster conference', true),
  ],
  Tenderfoot: [
    R('1a', 'Show your gear for an overnight and how to pack and carry it'), R('1b', 'Spend a night camping in a tent you helped pitch'), R('1c', 'Explain how you followed the Outdoor Code and Leave No Trace'),
    R('2a', 'Help cook a patrol meal on a campout'), R('2b', 'Safely clean cooking and eating gear'), R('2c', 'Explain why the patrol eats together'),
    R('3a', 'Use the square knot for a real job'), R('3b', 'Use two half hitches for a real job'), R('3c', 'Use the taut-line hitch for a real job'), R('3d', 'Care for, sharpen and safely use a knife, saw and ax'),
    R('4a', 'Show first aid for the listed outdoor injuries'), R('4b', 'Describe local poisonous plants and treatment'), R('4c', 'Explain how to prevent those injuries and exposures'), R('4d', 'Put together a personal first-aid kit and explain it'),
    R('5a', 'Explain and use the buddy system'), R('5b', 'Describe what to do if you get lost'), R('5c', 'Explain safe hiking day and night'), R('5d', 'Explain durable surfaces with examples'),
    R('6a', 'Record your fitness test results'), R('6b', 'Make a 30-day plan to improve and track it'), R('6c', 'Show improvement after 30 days'),
    R('7a', 'Show how to display, raise, lower and fold the U.S. flag'), R('7b', 'Do 1 hour of approved service'),
    R('8', 'Teach someone the square knot with the Teaching EDGE'), R('9', 'Explain duty to God and four points of the Scout Law you\'ve lived'),
    R('10', 'Scoutmaster conference', true), R('11', 'Board of review', true),
  ],
  'Second Class': [
    R('1a', 'Take part in 5 activities (3 outdoors, 2 overnight)'), R('1b', 'Explain how you apply the Leave No Trace principles'), R('1c', 'Pick a patrol site and explain tent placement'),
    R('2a', 'Explain when a fire is and isn\'t appropriate'), R('2b', 'Prepare fire materials with a knife, saw or ax'), R('2c', 'Build, light and put out a low-impact fire'), R('2d', 'Set up and light a camp stove'),
    R('2e', 'Plan, cook and store a hot meal and explain nutrition'), R('2f', 'Tie a sheet bend and describe a use'), R('2g', 'Tie a bowline and describe a use'),
    R('3a', 'Use a compass, orient a map and name five map symbols'), R('3b', 'Hike 5 miles (or bike 10) with map and compass'), R('3c', 'Describe hiking hazards and prevention'), R('3d', 'Find directions without a compass, day and night'),
    R('4', 'Identify or find signs of 10 kinds of wild animals'),
    R('5a', 'Explain safe swim precautions'), R('5b', 'Pass the BSA beginner test'), R('5c', 'Show reach, throw and object rescues'), R('5d', 'Explain why reach and throw beat swimming rescues'),
    R('6a', 'Show first aid for the listed injuries'), R('6b', 'Show what to do for stopped breathing, stroke, bleeding and poisoning'), R('6c', 'Explain how to prevent those injuries'), R('6d', 'Explain emergency response at home and in the backcountry'), R('6e', 'Explain what to do at a car accident'),
    R('7a', 'Be active 30 minutes a day, 5 days a week, for 4 weeks'), R('7b', 'Share results and set an activity goal'), R('7c', 'Join a substance-danger program and discuss it'),
    R('8a', 'Take part in a flag ceremony'), R('8b', 'Explain respect for the U.S. flag'), R('8c', 'Set an earning goal with your parents and follow a plan'), R('8d', 'Compare prices at three stores'), R('8e', 'Do 2 hours of approved service'),
    R('9a', 'Explain the three R\'s of personal safety'), R('9b', 'Describe bullying and how to respond'), R('10', 'Explain duty to God and four more points of the Scout Law'),
    R('11', 'Scoutmaster conference', true), R('12', 'Board of review', true),
  ],
  'First Class': [
    R('1a', 'Take part in 10 activities (6 outdoors, 3 overnight)'), R('1b', 'Explain camping\'s impact and outdoor ethics'),
    R('2a', 'Plan a menu for a campout'), R('2b', 'Make the budget and shopping list and get the food'), R('2c', 'List the cooking gear needed'), R('2d', 'Handle and store perishable food safely'), R('2e', 'Serve as patrol cook on a campout'),
    R('3a', 'Discuss when to use lashings'), R('3b', 'Tie the timber hitch and clove hitch'), R('3c', 'Tie square, shear and diagonal lashings'), R('3d', 'Build a camp gadget or structure with lashings'),
    R('4a', 'Complete an orienteering course and measure height or width'), R('4b', 'Use a GPS to find and follow a route'),
    R('5a', 'Identify 10 kinds of native plants'), R('5b', 'Name two weather forecast sources'), R('5c', 'Describe three signs of bad weather'), R('5d', 'Plan for local extreme weather'),
    R('6a', 'Pass the BSA swimmer test'), R('6b', 'Explain safe trip afloat precautions'), R('6c', 'Name boat and paddle parts'), R('6d', 'Show proper position in a boat'), R('6e', 'Show a line rescue as tender and rescuer'),
    R('7a', 'Show the listed bandages'), R('7b', 'Show the two rescue carries'), R('7c', 'Name heart attack signs and explain CPR'), R('7d', 'Explain home utilities and emergencies'), R('7e', 'Make a home emergency plan'), R('7f', 'Explain how to get safe drinking water in an emergency'),
    R('8a', 'Be active 30 minutes a day, 5 days a week, for 4 weeks'), R('8b', 'Share results and set an ongoing goal'),
    R('9a', 'Talk with a community leader about citizenship'), R('9b', 'Investigate a local environmental issue'), R('9c', 'Track and reduce outing trash'), R('9d', 'Do 3 hours of new approved service'),
    R('10', 'Invite someone to a Scouting activity'), R('11', 'Explain duty to God and four more points of the Scout Law'),
    R('12', 'Scoutmaster conference', true), R('13', 'Board of review', true),
  ],
};
export const REQ_RANKS = Object.keys(REQS);
export const ALL_REQ_IDS = new Set(REQ_RANKS.flatMap(r => REQS[r].map(x => `${r}|${x.id}`)));
// service hours each rank needs (Life: at least 3 conservation)
export const SERVICE_GOALS = [['Tenderfoot', 1, 0], ['Second Class', 2, 0], ['First Class', 3, 0], ['Star', 6, 0], ['Life', 6, 3]];
