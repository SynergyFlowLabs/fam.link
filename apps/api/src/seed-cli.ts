import { loadStore, persist, repositoryPath } from './db.js';

const store = loadStore();
persist();
console.log(`Seeded ${store.persons.length} people, ${store.relationships.length} relationships at ${repositoryPath()}`);
