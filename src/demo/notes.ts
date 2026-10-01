import { type Enrichment } from '@/features/notes/model';

/**
 * Fictional notes for demo mode, CI and first-run screenshots. Every name,
 * place and plan here is invented.
 */
export type DemoNote = Enrichment & {
  daysAgo: number;
  hour: number;
  minute: number;
  sentences: string[];
  done?: number[];
};

export const DEMO_NOTES: readonly DemoNote[] = [
  {
    daysAgo: 0,
    hour: 8,
    minute: 42,
    title: 'Launch week priorities',
    summary:
      'The beta goes out Thursday, so the onboarding copy and the crash on older Android phones come first. The pricing page can wait until next sprint.',
    tags: ['work', 'launch'],
    actionItems: [
      'Send Mara the final onboarding copy',
      'Reproduce the Android 12 crash',
      'Move pricing page to next sprint',
    ],
    mood: 'positive',
    sentences: [
      'Okay, launch week.',
      'The beta goes out on Thursday, so two things matter more than anything else.',
      'First, I need to send Mara the final onboarding copy by tomorrow lunchtime.',
      'Second, that crash on older Android phones, I have to reproduce it on an Android 12 device today.',
      'The pricing page is not urgent, let us move it to next sprint.',
      'Honestly I feel good about this one.',
    ],
  },
  {
    daysAgo: 0,
    hour: 7,
    minute: 15,
    title: 'Morning run and knee check',
    summary:
      'Easy five kilometres at an even pace. The left knee felt tight on the downhill again, so the long run on Sunday gets shortened.',
    tags: ['running', 'health'],
    actionItems: ['Shorten Sunday long run to 12 km', 'Book a physio check for the left knee'],
    mood: 'mixed',
    sentences: [
      'Just got back from an easy five K, about five forty per kilometre the whole way.',
      'Left knee felt tight on the downhill by the river again.',
      'Not painful, just tight, but it is the third time this month.',
      'I am going to shorten the long run on Sunday to twelve kilometres instead of eighteen.',
      'And I should book a physio check before the half marathon in November.',
    ],
  },
  {
    daysAgo: 1,
    hour: 19,
    minute: 5,
    title: 'Groceries for the dinner party',
    summary:
      'Six people on Saturday, one vegetarian. The plan is the lemon risotto with a big green salad, and Jonas is bringing dessert.',
    tags: ['cooking', 'friends'],
    actionItems: [
      'Buy arborio rice, lemons and parmesan',
      'Pick up wine on Friday',
      'Text Jonas to confirm dessert',
    ],
    mood: 'positive',
    done: [1],
    sentences: [
      'Dinner party on Saturday, six people including me.',
      'Ines is vegetarian, so the lemon risotto works for everyone.',
      'I need arborio rice, lemons, parmesan, and a lot of rocket for the salad.',
      'Pick up the wine on Friday after work.',
      'Jonas said he would bring dessert, I should text him to confirm.',
    ],
  },
  {
    daysAgo: 1,
    hour: 12,
    minute: 30,
    title: 'Dentist moved to Friday',
    summary:
      'The clinic called to move the cleaning to Friday at 9:15. That clashes with standup, so standup has to move.',
    tags: ['health', 'admin'],
    actionItems: ['Move Friday standup to 10:30', 'Add dentist to the calendar'],
    mood: 'neutral',
    sentences: [
      'The dental clinic just called.',
      'My cleaning moved from Wednesday to Friday at nine fifteen.',
      'That clashes with standup, so I need to move standup to ten thirty on Friday.',
      'And add it to the calendar before I forget.',
    ],
  },
  {
    daysAgo: 2,
    hour: 21,
    minute: 48,
    title: 'Story idea: the lighthouse archive',
    summary:
      'A keeper who catalogues the messages ships flash at night, until one is addressed to her. Could work as a short story first.',
    tags: ['writing', 'ideas'],
    actionItems: ['Write a one-page outline of the lighthouse story'],
    mood: 'positive',
    sentences: [
      'Story idea before I fall asleep.',
      'A lighthouse keeper whose real job is cataloguing the messages that ships flash at night.',
      'Decades of them, in a basement archive.',
      'Then one night a message is addressed to her, from a ship that sank forty years ago.',
      'Start it as a short story, maybe three thousand words.',
      'I want to write a one page outline this weekend.',
    ],
  },
  {
    daysAgo: 3,
    hour: 18,
    minute: 20,
    title: 'Lisbon trip planning',
    summary:
      'Flights for the 12th to the 16th are cheapest from the city airport. Staying in Alfama, with a day trip to Sintra on the Tuesday.',
    tags: ['travel', 'lisbon'],
    actionItems: [
      'Book flights for the 12th',
      'Reserve the Alfama apartment',
      'Check passport expiry date',
    ],
    mood: 'positive',
    sentences: [
      'Lisbon planning.',
      'Flights from the twelfth to the sixteenth are cheapest from the city airport, about one hundred and forty return.',
      'I would like to stay in Alfama, near the castle.',
      'Day trip to Sintra on the Tuesday, go early before the crowds.',
      'Need to book the flights this week and reserve the apartment.',
      'Also check when my passport expires, I think it is next year.',
    ],
  },
  {
    daysAgo: 5,
    hour: 9,
    minute: 10,
    title: 'Monthly budget review',
    summary:
      'Spending was over on eating out and under on transport. Moving the difference into the travel fund and cancelling the unused streaming plan.',
    tags: ['money'],
    actionItems: ['Cancel the second streaming subscription', 'Move 150 into the travel fund'],
    mood: 'neutral',
    sentences: [
      'Budget review for September.',
      'Eating out was about eighty over, transport was a hundred and twenty under because of cycling.',
      'So net I am fine, but I want to move one hundred and fifty into the travel fund.',
      'I have to cancel the second streaming subscription, I have not opened it in two months.',
    ],
  },
  {
    daysAgo: 6,
    hour: 13,
    minute: 45,
    title: 'Birthday gift for Lena',
    summary:
      'Lena mentioned wanting to get back into film photography. A refurbished point-and-shoot plus a few rolls would fit the budget.',
    tags: ['family', 'gifts'],
    actionItems: ['Look for a refurbished film camera', 'Order three rolls of colour film'],
    mood: 'positive',
    sentences: [
      'Gift idea for Lena, her birthday is on the twenty third.',
      'She said last month she wants to get back into film photography.',
      'A refurbished point and shoot would be perfect, under a hundred if I find a good one.',
      'Plus three rolls of colour film so she can start straight away.',
    ],
  },
  {
    daysAgo: 9,
    hour: 17,
    minute: 2,
    title: 'Balcony garden for winter',
    summary:
      'The basil is finished but the rosemary and thyme are thriving. Time to bring the chilli plant indoors before the first frost.',
    tags: ['garden', 'home'],
    actionItems: ['Bring the chilli plant indoors', 'Buy fleece covers for the herbs'],
    mood: 'neutral',
    done: [0],
    sentences: [
      'Balcony check.',
      'The basil is done for the year, the rosemary and thyme are doing great though.',
      'The forecast says first frost next week, so the chilli plant has to come inside.',
      'I should buy fleece covers for the herbs as well.',
    ],
  },
  {
    daysAgo: 13,
    hour: 20,
    minute: 30,
    title: 'Lease renewal questions',
    summary:
      'The landlord offered a two-year renewal with a 3% increase. Worth asking about fixing the bathroom fan before signing.',
    tags: ['home', 'admin'],
    actionItems: ['Email the landlord about the bathroom fan', 'Compare two similar flats nearby'],
    mood: 'mixed',
    sentences: [
      'The landlord sent the renewal offer.',
      'Two years, with a three percent increase, which is less than I feared.',
      'But the bathroom fan has been broken since spring.',
      'I am going to email him and ask for it to be fixed before I sign.',
      'And compare two similar flats nearby so I know what the market looks like.',
    ],
  },
  {
    daysAgo: 20,
    hour: 8,
    minute: 0,
    title: 'Spanish practice plan',
    summary:
      'Fifteen minutes a day works better than one long session. Switching podcasts to the intermediate level and booking a weekly conversation class.',
    tags: ['learning', 'spanish'],
    actionItems: ['Book a weekly conversation class', 'Switch to the intermediate podcast'],
    mood: 'positive',
    sentences: [
      'Thinking about Spanish again.',
      'Fifteen minutes every morning has worked much better than one long session at the weekend.',
      'The beginner podcast is too easy now, switch to the intermediate one.',
      'I want to book a weekly conversation class, Thursdays would be ideal.',
    ],
  },
  {
    daysAgo: 34,
    hour: 22,
    minute: 10,
    title: 'Reflections after a long week',
    summary:
      'Tired but proud of how the team handled the outage. Saying no to the extra committee would free up Wednesday evenings.',
    tags: ['reflection', 'work'],
    actionItems: ['Decline the events committee invitation'],
    mood: 'mixed',
    sentences: [
      'Long week.',
      'The outage on Tuesday was stressful, but the team handled it really calmly and I am proud of that.',
      'I am tired though, properly tired.',
      'I think I should say no to the events committee, it would give me Wednesday evenings back.',
    ],
  },
];

/** What the fake transcriber "hears" for the bundled sample clip and for live recordings in demo mode. */
export const DEMO_RECORDING_SCRIPT =
  "Quick reminder for tomorrow. I need to email Priya the updated budget before ten, and pick up the dry cleaning on the way home. The team offsite moved to the fourteenth, so I should book the train tickets this week. Honestly I'm feeling good about the launch.";
