// This is a DataTree schema
// For more info, visit https://www.npmjs.com/package/@dustjs/data-tree

export const metadata = {
  AppName: 'IRC Client',
  Author: 'Daniel Lamando',
  License: 'GPL-3.0-or-later',
};
export function builder(El, addRoot) {

  addRoot(new El.AppRegion('config', {
    '/prefs': new El.Document({
      '/layout': String,
      '/disable-nicklist': Boolean,
      '/enable-notifs': Boolean,

      '/userstyle.css': new El.Blob('text/css', 'utf-8'),
    }),

    '/networks': new El.NamedCollection({
      '/auto-connect': Boolean,
      '/channels': new El.StringMap({
        '/auto-join': Boolean,
        '/key': String,
      }),
      '/full-name': String,
      '/hostname': String,
      '/ident': String,
      '/nickname': String,
      '/nickserv-pass': String,
      '/password': String,
      '/port': Number,
      '/use-tls': Boolean,
      '/username': String,
    }),
  }));

  // Reused by various things that contain IRC logs
  const ircPacket = new El.Document({
    // internal usage
    '/source': String, // where the event came from
    '/timestamp': Date, // when the event was observed
    '/is-mention': Boolean, // whether the message should be highlighted
    // for events that weren't ever actual IRC (dialing, etc)
    // TODO: just synthesize fake IRC events lol
    '/sender': String,
    '/text': String,
    // standard IRC protocol fields
    '/prefix-name': String,
    '/prefix-user': String,
    '/prefix-host': String,
    '/command': String,
    '/params': [String],
    // IRCv3 addon metadata
    '/tags': new El.StringMap(String),
  });

  addRoot(new El.AppRegion('persist', {
    '/wires': new El.NamedCollection({
      '/wire-uri': String,
      '/checkpoint': Number,
    }),

    '/networks': new El.NamedCollection({
      '/avail-chan-modes': String,
      '/avail-user-modes': String,
      '/current-nick': String,
      '/latest-seen': String,
      '/paramed-chan-modes': String,
      '/server-hostname': String,
      '/server-software': String,
      '/umodes': String,

      '/channels': new El.NamedCollection({
        '/is-joined': Boolean,
        '/latest-activity': String,
        '/latest-mention': String,
        '/latest-seen': String,

        '/log': new El.DatePartitionedLog(ircPacket),
        '/members': new El.NamedCollection({
          '/nick': String,
          // TODO: user/host should be stored in a network-central location, alongside account, realname, away, etc
          '/user': String,
          '/host': String,
          '/since': Date,
          '/modes': String,
          '/prefix': String,
        }),
        '/modes': new El.StringMap(String),
        // TODO: collection of topics, keep history
        '/topic/latest': String,
        '/topic/set-at': Date,
        '/topic/set-by': String,
        '/channel-url': String,
      }),

      '/queries': new El.NamedCollection({
        '/latest-activity': String,
        // '/latest-mention': String,
        '/latest-seen': String,

        '/log': new El.DatePartitionedLog(ircPacket),
      }),

      // TODO: graduate into a proper context
      '/mention-log': new El.DatePartitionedLog({
        '/location': String,
        '/sender': String,
        '/text': String,
        '/timestamp': Date,
        // TODO: /raw used to be a hardlink, so maybe also store a firestore ref
        '/raw': ircPacket,
      }, {
        firestorePath: 'logs/mentions/log',
      }),

      // TODO: graduate into a proper context
      '/server-log': new El.DatePartitionedLog(ircPacket, {
        firestorePath: 'logs/server/log',
      }),

      '/supported': new El.StringMap(String),
    }),

  }));

}
