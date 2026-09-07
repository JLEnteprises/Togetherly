import { Redirect, type Href } from 'expo-router';

export default function ProfileRedirect() {
  return <Redirect href={'/features/account' as Href} />;
}
