import Map "mo:core/Map";
import List "mo:core/List";

module {
  // ─── Old types (from previous main.mo) ───────────────────────────────────

  type OldMatchStatus = { #waiting; #inProgress; #completed };

  type OldMatch = {
    id        : Nat;
    player    : Principal;
    status    : OldMatchStatus;
    timestamp : Int;
  };

  type OldUserProfile = {
    username : Text;
    password : Text;
    wallet   : Nat;
  };

  type OldWalletTransactionStatus = { #approved; #pending; #rejected };

  type OldWalletTransaction = {
    id              : Nat;
    user            : Principal;
    amount          : Nat;
    transactionType : { #deposit; #withdrawal };
    status          : OldWalletTransactionStatus;
    timestamp       : Int;
  };

  // AccessControl state (actual shape from old actor)
  type UserRole = { #admin; #guest; #user };
  type OldAccessControlState = {
    var adminAssigned : Bool;
    userRoles         : Map.Map<Principal, UserRole>;
  };

  // ─── Old actor stable record ──────────────────────────────────────────────

  type OldActor = {
    accessControlState  : OldAccessControlState;
    matches             : Map.Map<Nat, OldMatch>;
    userProfiles        : Map.Map<Principal, OldUserProfile>;
    walletTransactions  : Map.Map<Nat, OldWalletTransaction>;
    matchIdCounter      : Nat;
    transactionIdCounter: Nat;
  };

  // ─── New actor stable record ──────────────────────────────────────────────

  type User = {
    uid                : Text;
    password           : Text;
    name               : Text;
    phone              : Text;
    walletBalance      : Float;
    coins              : Nat;
    isAdmin            : Bool;
    isBanned           : Bool;
    banReason          : Text;
    kycVerified        : Bool;
    totalMatchesPlayed : Nat;
    totalWins          : Nat;
    totalKills         : Nat;
    createdAt          : Int;
    lastLoginAt        : Int;
    vipTier            : Text;
    loyaltyPoints      : Nat;
    referralCode       : Text;
    referredBy         : Text;
    birthMonth         : Nat;
    loginStreak        : Nat;
    lastLoginDate      : Text;
    fcmToken           : Text;
  };

  type Match = {
    id               : Text;
    mode             : Text;
    title            : Text;
    entryFee         : Float;
    prizePool        : Float;
    perKill          : Float;
    maxPlayers       : Nat;
    currentPlayers   : Nat;
    status           : Text;
    roomId           : Text;
    roomPassword     : Text;
    scheduledTime    : Text;
    isHidden         : Bool;
    voiceChannelLink : Text;
    joinedPlayers    : [(Text, Text)];
    kills            : [(Text, Nat)];
    winner           : Text;
    adminProfit      : Float;
    createdAt        : Int;
  };

  type Transaction = {
    id        : Text;
    uid       : Text;
    txType    : Text;
    amount    : Float;
    coins     : Nat;
    status    : Text;
    upiId     : Text;
    note      : Text;
    createdAt : Int;
  };

  type Message = {
    id         : Text;
    text       : Text;
    senderId   : Text;
    senderName : Text;
    category   : Text;
    isPinned   : Bool;
    imageUrl   : Text;
    reactions  : [(Text, Text)];
    createdAt  : Int;
  };

  type Tournament = {
    id                : Text;
    name              : Text;
    status            : Text;
    entryFee          : Float;
    prizePool         : Float;
    registeredPlayers : [Text];
    startTime         : Int;
    winner            : Text;
    createdAt         : Int;
  };

  type Clan = {
    id        : Text;
    name      : Text;
    leaderId  : Text;
    members   : [Text];
    createdAt : Int;
  };

  type Report = {
    id         : Text;
    reporterId : Text;
    reportedId : Text;
    reason     : Text;
    createdAt  : Int;
  };

  type NewActor = {
    users            : Map.Map<Text, User>;
    matches          : Map.Map<Text, Match>;
    transactions     : Map.Map<Text, Transaction>;
    messages         : Map.Map<Text, Message>;
    tournaments      : Map.Map<Text, Tournament>;
    clans            : Map.Map<Text, Clan>;
    reports          : List.List<Report>;
    matchIdCounter   : Nat;
    txIdCounter      : Nat;
    msgIdCounter     : Nat;
    tourneyIdCounter : Nat;
    clanIdCounter    : Nat;
    reportIdCounter  : Nat;
  };

  // ─── Migration ────────────────────────────────────────────────────────────

  // Old schema is incompatible (Principal keys → Text keys, different types).
  // Start fresh — preserve old counters only to avoid ID collisions.
  public func run(old : OldActor) : NewActor {
    {
      users            = Map.empty<Text, User>();
      matches          = Map.empty<Text, Match>();
      transactions     = Map.empty<Text, Transaction>();
      messages         = Map.empty<Text, Message>();
      tournaments      = Map.empty<Text, Tournament>();
      clans            = Map.empty<Text, Clan>();
      reports          = List.empty<Report>();
      matchIdCounter   = old.matchIdCounter;
      txIdCounter      = old.transactionIdCounter;
      msgIdCounter     = 0;
      tourneyIdCounter = 0;
      clanIdCounter    = 0;
      reportIdCounter  = 0;
    }
  };
};
