export interface Quote {
  text: string;
  author?: string;
}

export const BUNDLED_QUOTES: Quote[] = [
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { text: 'What you do today can improve all your tomorrows.', author: 'Ralph Marston' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'You don’t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
  { text: 'Either you run the day or the day runs you.', author: 'Jim Rohn' },
  { text: 'Small deeds done are better than great deeds planned.', author: 'Peter Marshall' },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
  { text: 'Do the hard jobs first. The easy jobs will take care of themselves.', author: 'Dale Carnegie' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'Simplicity boils down to two steps: identify the essential, eliminate the rest.', author: 'Leo Babauta' },
  { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
  { text: 'Amateurs sit and wait for inspiration; the rest of us just get up and go to work.', author: 'Stephen King' },
  { text: 'Be so good they can’t ignore you.', author: 'Steve Martin' },
  { text: 'A year from now you may wish you had started today.', author: 'Karen Lamb' },
  { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
  { text: 'Don’t count the days, make the days count.', author: 'Muhammad Ali' },
  { text: 'Great things are done by a series of small things brought together.', author: 'Vincent van Gogh' },
  { text: 'Whether you think you can or you think you can’t, you’re right.', author: 'Henry Ford' },
  { text: 'The best way out is always through.', author: 'Robert Frost' },
  { text: 'Energy and persistence conquer all things.', author: 'Benjamin Franklin' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act but a habit.', author: 'Will Durant' },
  { text: 'If you spend too much time thinking about a thing, you’ll never get it done.', author: 'Bruce Lee' },
  { text: 'Rest is not idleness.', author: 'John Lubbock' },
  { text: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
  { text: 'How we spend our days is, of course, how we spend our lives.', author: 'Annie Dillard' },
  { text: 'Make each day your masterpiece.', author: 'John Wooden' },
  { text: 'Concentrate all your thoughts upon the work at hand.', author: 'Alexander Graham Bell' },
  { text: 'One day or day one. You decide.' },
  { text: 'Done is better than perfect.' },
  { text: 'Your future is created by what you do today, not tomorrow.' },
  { text: 'Slow is smooth, smooth is fast.' },
  { text: 'Progress, not perfection.' },
];

/** Parse "Quote — Author" / "Quote - Author" lines. */
export function parseQuoteLine(line: string): Quote | undefined {
  const t = line.trim();
  if (!t) return undefined;
  const m = t.match(/^(.*?)\s+[—–-]\s+([^—–-]+)$/);
  return m ? { text: m[1].trim(), author: m[2].trim() } : { text: t };
}
