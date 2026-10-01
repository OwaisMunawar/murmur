import { dropExampleLeaks } from '../leaks';

describe('dropExampleLeaks', () => {
  const transcript =
    'Need oat milk, lemons and coffee for the weekend. Call the plumber about the sink.';

  it('drops fields copied from the worked example', () => {
    expect(
      dropExampleLeaks(
        {
          title: 'Bike clicking noise',
          summary: 'The bike needs brake pads from the shop.',
          tags: ['bike', 'groceries'],
          action_items: ['Ask about new brake pads', 'Call the plumber'],
          mood: 'neutral',
        },
        transcript,
      ),
    ).toEqual({ tags: ['groceries'], action_items: ['Call the plumber'], mood: 'neutral' });
  });

  it('keeps example words the speaker actually said', () => {
    const fields = { title: 'Bike shop on Saturday', tags: ['bike'], summary: 'Bike to the shop.' };
    expect(dropExampleLeaks(fields, 'Take the bike to the shop on Saturday')).toEqual(fields);
  });

  it('removes the tag list entirely when every tag leaked', () => {
    expect(dropExampleLeaks({ tags: ['repairs'] }, transcript)).toEqual({});
  });
});
