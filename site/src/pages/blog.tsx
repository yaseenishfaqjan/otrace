import { Link, useRoute } from 'wouter';
import { POSTS, journalBlurb } from '@/content/posts';
import { SiteImage } from '@/components/site-image';
import { DyeDiagram, FitDiagram, GsmDiagram } from '@/components/blog-diagrams';
import { imageSize } from '@/lib/image-size';
import { breadcrumbLd } from '@/lib/structured-data';
import { absoluteUrl, SITE_URL, usePageMeta } from '@/lib/use-page-meta';
import NotFound from '@/pages/not-found';

type Post = (typeof POSTS)[number];

const linkRe = /\[([^\]]+)\]\((\/[^)\s]+)\)/g;

function Inline({ text }: { text: string }) {
  const nodes: (string | { label: string; href: string })[] = [];
  let last = 0;
  for (const match of text.matchAll(linkRe)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    nodes.push({ label: match[1], href: match[2] });
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return (
    <>
      {nodes.map((node, i) =>
        typeof node === 'string' ? (
          <span key={i}>{node}</span>
        ) : (
          <Link key={i} href={node.href} className="text-cream underline underline-offset-4">
            {node.label}
          </Link>
        ),
      )}
    </>
  );
}

function Figure({
  src,
  alt,
  caption,
  priority = false,
}: {
  src: string;
  alt: string;
  caption: string;
  priority?: boolean;
}) {
  const size = imageSize(src);
  return (
    <figure className="mt-10">
      <SiteImage
        src={src}
        alt={alt}
        width={size.width}
        height={size.height}
        pictureClassName="block w-full"
        className="w-full h-auto object-cover"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
      <figcaption className="text-muted text-xs mt-3">{caption}</figcaption>
    </figure>
  );
}

function Diagram({ id }: { id: Post['diagram'] }) {
  if (id === 'gsm') return <GsmDiagram />;
  if (id === 'dye') return <DyeDiagram />;
  return <FitDiagram />;
}

function postingLd(post: Post) {
  const url = absoluteUrl(`/blog/${post.slug}`);
  const images = [post.hero, ...post.sections.flatMap((section) => (section.image ? [section.image] : []))];
  return {
    '@context': 'https://schema.org',
    '@type': ['BlogPosting', 'Article'],
    headline: post.h1,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'OTRACE', url: SITE_URL },
    publisher: { '@id': `${SITE_URL}/#organization` },
    image: images.map((image) => absoluteUrl(image.src)),
    mainEntityOfPage: url,
    url,
  };
}

export function BlogIndex() {
  usePageMeta('Journal', journalBlurb, {
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'OTRACE Journal',
        description: journalBlurb,
        url: absoluteUrl('/blog'),
        publisher: { '@id': `${SITE_URL}/#organization` },
        blogPost: POSTS.map((post) => ({
          '@type': 'BlogPosting',
          headline: post.h1,
          url: absoluteUrl(`/blog/${post.slug}`),
          datePublished: post.date,
        })),
      },
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'Journal', path: '/blog' },
      ]),
    ],
  });

  return (
    <div className="pt-16 md:pt-20">
      <div className="shell py-12 md:py-16 max-w-3xl">
        <p className="eyebrow text-muted mb-4">Notes</p>
        <h1 className="display text-cream text-[12vw] md:text-[4.5rem]">Journal</h1>
        <p className="text-cream-dim leading-relaxed mt-6 max-w-xl">{journalBlurb}</p>
        <div className="mt-14 divide-y divide-line border-y border-line">
          {POSTS.map((post) => {
            const size = imageSize(post.hero.src);
            return (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="grid sm:grid-cols-[9rem_1fr] gap-5 py-8 group">
                <SiteImage
                  src={post.hero.src}
                  alt={post.hero.alt}
                  width={size.width}
                  height={size.height}
                  pictureClassName="block"
                  className="w-full aspect-[4/5] object-cover"
                  loading="lazy"
                />
                <span>
                  <span className="eyebrow text-muted">{post.eyebrow}</span>
                  <span className="block text-cream text-2xl mt-3 group-hover:underline underline-offset-4">{post.h1}</span>
                  <span className="block text-cream-dim text-sm leading-relaxed mt-3">{post.description}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function BlogPost() {
  const [, params] = useRoute('/blog/:slug');
  const post = POSTS.find((item) => item.slug === params?.slug);
  usePageMeta(
    post ? post.h1 : 'Journal',
    post?.description,
    post
      ? {
          jsonLd: [
            postingLd(post),
            breadcrumbLd([
              { name: 'Home', path: '/' },
              { name: 'Journal', path: '/blog' },
              { name: post.h1, path: `/blog/${post.slug}` },
            ]),
          ],
        }
      : { noindex: true },
  );
  if (!post) return <NotFound />;

  return (
    <div className="pt-16 md:pt-20">
      <article className="shell py-12 md:py-16 max-w-3xl">
        <p className="eyebrow text-muted mb-4">
          <Link href="/blog" className="hover:text-cream">Journal</Link>
          <span className="mx-2">/</span>
          {post.eyebrow}
        </p>
        <h1 className="display text-cream text-[9vw] md:text-[3.4rem] leading-[1.05]">{post.h1}</h1>
        <p className="text-cream-dim leading-relaxed mt-8 text-base md:text-lg">{post.answer}</p>
        <Figure {...post.hero} priority />
        <Diagram id={post.diagram} />
        {post.sections.map((section) => (
          <section key={section.h2} className="mt-14">
            <h2 className="text-cream text-xl font-medium">{section.h2}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="text-cream-dim leading-relaxed mt-4">
                <Inline text={paragraph} />
              </p>
            ))}
            {section.image && <Figure {...section.image} />}
          </section>
        ))}
      </article>
    </div>
  );
}
