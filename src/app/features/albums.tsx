import { Redirect, type Href } from 'expo-router';

export default function AlbumsRedirect() {
  return <Redirect href={'/features/photos?view=albums' as Href} />;
}
