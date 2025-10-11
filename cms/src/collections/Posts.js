export const Posts = {
  slug: 'posts',
  admin: { useAsTitle: 'title' },
  versions: { drafts: true, maxPerDoc: 20 },
  access: { read: () => true }, // public read
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'summary', type: 'textarea' },
    { name: 'tags', type: 'array', fields: [{ name: 'value', type: 'text' }] },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    {
      name: 'status',
      type: 'select',
      options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }],
      defaultValue: 'draft',
      required: true,
      admin: { position: 'sidebar' },
    },
    { name: 'body', type: 'richText', required: true },
    { name: 'publishedAt', type: 'date', admin: { position: 'sidebar' } },
    { name: 'jsonLd', type: 'json' }, // optional SEO JSON-LD
  ],
}
