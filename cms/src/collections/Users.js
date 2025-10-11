export const Users = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [
    { name: 'name', type: 'text' },
    { name: 'role', type: 'select', options: ['author', 'editor', 'admin'], defaultValue: 'author' },
  ],
}
