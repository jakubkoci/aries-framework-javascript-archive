export function parseInvitationUrl(invitationUrl: string) {
  const [, encodedInvitation] = invitationUrl.split('c_i=');
  const invitation = JSON.parse(Buffer.from(encodedInvitation, 'base64').toString());
  return invitation;
}
