export const Media = {
  slug: 'media',
  upload: {
    mimeTypes: ['image/*'], // storage handled by cloud-storage plugin
  },
  access: { read: () => true },
  fields: [
    { name: 'alt', type: 'text', required: true },
    { name: 'credit', type: 'text' },
  ],
}
