export const $ = (id) => document.getElementById(id);

export function getDom() {
  return {
    // inputs
    nickEl: $("nick"),
    joinCodeEl: $("joinCode"),
    masterCodeEl: $("masterCode"),

    // lobby buttons
    createRoomBtn: $("createRoomBtn"),
    joinRoomBtn: $("joinRoomBtn"),
    rejoinMasterBtn: $("rejoinMasterBtn"),

    // connection UI (se presente)
    connCard: $("connCard"),
    connTitle: $("connTitle"),
    connMsg: $("connMsg"),
    connRetryBtn: $("connRetryBtn"),

    // sections
    lobby: $("lobby"),
    room: $("room"),
    feedCard: $("feedCard"),

    // room UI
    roomMeta: $("roomMeta"),
    playersList: $("playersList"),
    feed: $("feed"),

    // dice UI
    diceGrid: $("diceGrid"),
    selectionTag: $("selectionTag"),
    rollPublicBtn: $("rollPublicBtn"),
    rollGmBtn: $("rollGmBtn"),
    resetSelectionBtn: $("resetSelectionBtn"),
    sendSecretBtn: $("sendSecretBtn"),

    // codes UI
    codesBox: $("codesBox"),
    joinCodeOut: $("joinCodeOut"),
    masterCodeOut: $("masterCodeOut"),
    inviteLinkOut: $("inviteLinkOut"),
    copyJoinBtn: $("copyJoinBtn"),
    copyMasterBtn: $("copyMasterBtn"),
    copyInviteBtn: $("copyInviteBtn"),
    toggleMasterBtn: $("toggleMasterBtn"),

    // GM tools (esistono in HTML)
    gmTools: $("gmTools"),
    targetPlayer: $("targetPlayer"),
    requestSecretBtn: $("requestSecretBtn"),
    secretNote: $("secretNote"),

    // socket loader tag
    socketioScript: $("socketioScript"),
  };
}
