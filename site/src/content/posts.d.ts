export const journalBlurb: string;

export type PostImage = { src: string; alt: string; caption: string };

export type PostSection = {
  h2: string;
  paragraphs: string[];
  image?: PostImage;
};

export type Post = {
  slug: string;
  h1: string;
  description: string;
  date: string;
  eyebrow: string;
  answer: string;
  hero: PostImage;
  diagram: 'gsm' | 'dye' | 'fit';
  sections: PostSection[];
};

export const POSTS: Post[];
