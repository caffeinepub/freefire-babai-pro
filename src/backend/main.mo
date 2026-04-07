import Array "mo:core/Array";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Map "mo:core/Map";
import Float "mo:core/Float";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";
import Migration "migration";

(with migration = Migration.run)
actor {

  // ─── Types ────────────────────────────────────────────────────────────────

  // All state types are immutable records; we replace entries in maps to "update"

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

  // Public projection of User (no phone, no password)
  type UserPublic = {
    uid                : Text;
    name               : Text;
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

  // Admin projection of User (includes phone, no password)
  type UserAdmin = {
    uid                : Text;
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
  };

  // ─── State ────────────────────────────────────────────────────────────────

  let users        = Map.empty<Text, User>();
  let matches      = Map.empty<Text, Match>();
  let transactions = Map.empty<Text, Transaction>();
  let messages     = Map.empty<Text, Message>();
  let tournaments  = Map.empty<Text, Tournament>();
  let clans        = Map.empty<Text, Clan>();
  let reports      = List.empty<Report>();

  var matchIdCounter   : Nat = 0;
  var txIdCounter      : Nat = 0;
  var msgIdCounter     : Nat = 0;
  var tourneyIdCounter : Nat = 0;
  var clanIdCounter    : Nat = 0;
  var reportIdCounter  : Nat = 0;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  func genId(prefix : Text, counter : Nat) : Text {
    prefix # counter.toText()
  };

  func getUser(uid : Text) : User {
    switch (users.get(uid)) {
      case (?u) u;
      case null Runtime.trap("User not found: " # uid);
    }
  };

  func requireAdmin(uid : Text) {
    let u = getUser(uid);
    if (not u.isAdmin) Runtime.trap("Unauthorized: admin only");
  };

  func requireNotBanned(uid : Text) {
    let u = getUser(uid);
    if (u.isBanned) Runtime.trap("Account banned: " # u.banReason);
  };

  func userVipTier(balance : Float) : Text {
    if (balance >= 5000.0)      "gold"
    else if (balance >= 2000.0) "silver"
    else if (balance >= 500.0)  "bronze"
    else                        "none"
  };

  func userToPublic(u : User) : UserPublic {
    {
      uid                = u.uid;
      name               = u.name;
      walletBalance      = u.walletBalance;
      coins              = u.coins;
      isAdmin            = u.isAdmin;
      isBanned           = u.isBanned;
      banReason          = u.banReason;
      kycVerified        = u.kycVerified;
      totalMatchesPlayed = u.totalMatchesPlayed;
      totalWins          = u.totalWins;
      totalKills         = u.totalKills;
      createdAt          = u.createdAt;
      lastLoginAt        = u.lastLoginAt;
      vipTier            = u.vipTier;
      loyaltyPoints      = u.loyaltyPoints;
      referralCode       = u.referralCode;
      referredBy         = u.referredBy;
      birthMonth         = u.birthMonth;
      loginStreak        = u.loginStreak;
      lastLoginDate      = u.lastLoginDate;
      fcmToken           = u.fcmToken;
    }
  };

  func userToAdmin(u : User) : UserAdmin {
    {
      uid                = u.uid;
      name               = u.name;
      phone              = u.phone;
      walletBalance      = u.walletBalance;
      coins              = u.coins;
      isAdmin            = u.isAdmin;
      isBanned           = u.isBanned;
      banReason          = u.banReason;
      kycVerified        = u.kycVerified;
      totalMatchesPlayed = u.totalMatchesPlayed;
      totalWins          = u.totalWins;
      totalKills         = u.totalKills;
      createdAt          = u.createdAt;
      lastLoginAt        = u.lastLoginAt;
      vipTier            = u.vipTier;
      loyaltyPoints      = u.loyaltyPoints;
      referralCode       = u.referralCode;
      referredBy         = u.referredBy;
      birthMonth         = u.birthMonth;
      loginStreak        = u.loginStreak;
      lastLoginDate      = u.lastLoginDate;
    }
  };

  func addTx(uid : Text, txType : Text, amount : Float, coins : Nat, status : Text, upiId : Text, note : Text) {
    txIdCounter += 1;
    let tx : Transaction = {
      id = genId("tx", txIdCounter);
      uid;
      txType;
      amount;
      coins;
      status;
      upiId;
      note;
      createdAt = Time.now();
    };
    transactions.add(tx.id, tx);
  };

  // ─── Auth ─────────────────────────────────────────────────────────────────

  public func registerUser(
    uid        : Text,
    password   : Text,
    name       : Text,
    phone      : Text,
    referredBy : Text,
  ) : async Text {
    if (users.containsKey(uid)) { return "UID already taken" };
    let now = Time.now();
    let refCode = uid # Int.abs(now).toText();
    var startCoins : Nat = 10;
    // Check if referredBy matches any user's referralCode
    var referrerId : Text = "";
    if (referredBy != "") {
      for ((ruid, ru) in users.entries()) {
        if (ru.referralCode == referredBy) {
          referrerId := ruid;
          startCoins += 50;
        };
      };
    };
    let newUser : User = {
      uid;
      password;
      name;
      phone;
      walletBalance      = 0.0;
      coins              = startCoins;
      isAdmin            = uid == "admin";
      isBanned           = false;
      banReason          = "";
      kycVerified        = false;
      totalMatchesPlayed = 0;
      totalWins          = 0;
      totalKills         = 0;
      createdAt          = now;
      lastLoginAt        = now;
      vipTier            = "none";
      loyaltyPoints      = 0;
      referralCode       = refCode;
      referredBy;
      birthMonth         = 0;
      loginStreak        = 0;
      lastLoginDate      = "";
      fcmToken           = "";
    };
    users.add(uid, newUser);
    // Award referrer bonus
    if (referrerId != "") {
      let ref = getUser(referrerId);
      users.add(referrerId, { ref with coins = ref.coins + 50 });
    };
    ""
  };

  public func login(uid : Text, password : Text) : async (?UserPublic, Text) {
    switch (users.get(uid)) {
      case null { (null, "User not found") };
      case (?u) {
        if (u.password != password) return (null, "Wrong password");
        if (u.isBanned)             return (null, "Account banned: " # u.banReason);
        users.add(uid, { u with lastLoginAt = Time.now() });
        (?(userToPublic(getUser(uid))), "")
      };
    }
  };

  public query func getMyProfile(uid : Text) : async ?UserPublic {
    switch (users.get(uid)) {
      case (?u) ?(userToPublic(u));
      case null null;
    }
  };

  public func updateFcmToken(uid : Text, token : Text) : async () {
    switch (users.get(uid)) {
      case (?u) users.add(uid, { u with fcmToken = token });
      case null {};
    }
  };

  public func updateProfile(uid : Text, name : Text, phone : Text, birthMonth : Nat) : async () {
    switch (users.get(uid)) {
      case (?u) users.add(uid, { u with name; phone; birthMonth });
      case null {};
    }
  };

  // ─── Wallet ───────────────────────────────────────────────────────────────

  public func submitDeposit(uid : Text, amount : Float, upiId : Text) : async Text {
    requireNotBanned(uid);
    if (amount < 30.0) return "Minimum deposit is ₹30";
    let pts = Int.abs((amount / 10.0).toInt());
    let u = getUser(uid);
    users.add(uid, { u with loyaltyPoints = u.loyaltyPoints + pts });
    addTx(uid, "deposit", amount, 0, "pending", upiId, "");
    genId("tx", txIdCounter)
  };

  public func submitWithdrawal(uid : Text, amount : Float, upiId : Text) : async Text {
    requireNotBanned(uid);
    if (amount < 100.0) return "Minimum withdrawal is ₹100";
    let u = getUser(uid);
    if (u.walletBalance < amount) return "Insufficient balance";
    users.add(uid, { u with walletBalance = u.walletBalance - amount });
    addTx(uid, "withdrawal", amount, 0, "pending", upiId, "");
    genId("tx", txIdCounter)
  };

  public query func getUserTransactions(uid : Text) : async [Transaction] {
    transactions.values()
      .filter(func(t : Transaction) : Bool { t.uid == uid })
      .toArray()
  };

  // ─── Matches ──────────────────────────────────────────────────────────────

  public query func getMatches() : async [Match] {
    matches.values()
      .filter(func(m : Match) : Bool { not m.isHidden })
      .toArray()
  };

  public query func getMatch(matchId : Text) : async ?Match {
    matches.get(matchId)
  };

  public func joinMatch(uid : Text, matchId : Text) : async Text {
    requireNotBanned(uid);
    let m = switch (matches.get(matchId)) {
      case (?x) x;
      case null return "Match not found";
    };
    if (m.status == "full" or m.status == "completed" or m.status == "cancelled") {
      return "Match is not joinable"
    };
    let alreadyJoined = m.joinedPlayers.find<(Text, Text)>(func((u, _)) { u == uid }) != null;
    if (alreadyJoined) return "Already joined";
    let u = getUser(uid);
    if (u.walletBalance < m.entryFee) return "Insufficient balance";
    let newBalance    = u.walletBalance - m.entryFee;
    let newVip        = userVipTier(newBalance);
    let newMatches    = u.totalMatchesPlayed + 1;
    users.add(uid, { u with walletBalance = newBalance; vipTier = newVip; totalMatchesPlayed = newMatches });
    addTx(uid, "entry", m.entryFee, 0, "approved", "", "Entry fee for match " # matchId);
    let newPlayers = m.joinedPlayers.concat([(uid, u.name)]);
    let newCount   = newPlayers.size();
    let newStatus  = if (newCount >= m.maxPlayers) "full" else m.status;
    let newProfit  = m.adminProfit + m.entryFee * 0.1;
    matches.add(matchId, {
      m with
      joinedPlayers  = newPlayers;
      currentPlayers = newCount;
      status         = newStatus;
      adminProfit    = newProfit;
    });
    ""
  };

  // ─── Messages ─────────────────────────────────────────────────────────────

  public query func getMessages() : async [Message] {
    messages.values().toArray()
  };

  public func reactToMessage(uid : Text, msgId : Text, emoji : Text) : async () {
    switch (messages.get(msgId)) {
      case (?m) {
        let filtered = m.reactions.filter(func((u, _)) { u != uid });
        let newReactions = filtered.concat([(uid, emoji)]);
        messages.add(msgId, { m with reactions = newReactions });
      };
      case null {};
    }
  };

  // ─── Leaderboard ─────────────────────────────────────────────────────────

  public query func getLeaderboard() : async [UserPublic] {
    users.values()
      .map<User, UserPublic>(func(u) { userToPublic(u) })
      .toArray()
      .sort(func(a : UserPublic, b : UserPublic) : Order.Order {
        if (a.walletBalance > b.walletBalance) #less
        else if (a.walletBalance < b.walletBalance) #greater
        else #equal
      })
  };

  // ─── Clans ────────────────────────────────────────────────────────────────

  public func createClan(uid : Text, name : Text) : async Text {
    requireNotBanned(uid);
    clanIdCounter += 1;
    let clanId = genId("clan", clanIdCounter);
    clans.add(clanId, {
      id       = clanId;
      name;
      leaderId = uid;
      members  = [uid];
      createdAt = Time.now();
    });
    clanId
  };

  public func joinClan(uid : Text, clanId : Text) : async Text {
    requireNotBanned(uid);
    let c = switch (clans.get(clanId)) {
      case (?x) x;
      case null return "Clan not found";
    };
    let already = c.members.find<Text>(func(m) { m == uid }) != null;
    if (already) return "Already a member";
    clans.add(clanId, { c with members = c.members.concat<Text>([uid]) });
    ""
  };

  public query func getClans() : async [Clan] {
    clans.values().toArray()
  };

  // ─── Tournaments ──────────────────────────────────────────────────────────

  public query func getTournaments() : async [Tournament] {
    tournaments.values().toArray()
  };

  public func registerForTournament(uid : Text, tournamentId : Text) : async Text {
    requireNotBanned(uid);
    let t = switch (tournaments.get(tournamentId)) {
      case (?x) x;
      case null return "Tournament not found";
    };
    if (t.status != "open") return "Tournament not open";
    let already = t.registeredPlayers.find<Text>(func(p) { p == uid }) != null;
    if (already) return "Already registered";
    let u = getUser(uid);
    if (u.walletBalance < t.entryFee) return "Insufficient balance";
    users.add(uid, { u with walletBalance = u.walletBalance - t.entryFee });
    tournaments.add(tournamentId, {
      t with registeredPlayers = t.registeredPlayers.concat<Text>([uid])
    });
    ""
  };

  // ─── Reports ──────────────────────────────────────────────────────────────

  public func reportPlayer(reporterId : Text, reportedId : Text, reason : Text) : async () {
    reportIdCounter += 1;
    reports.add({
      id         = genId("rep", reportIdCounter);
      reporterId;
      reportedId;
      reason;
      createdAt  = Time.now();
    });
  };

  // ─── Admin ────────────────────────────────────────────────────────────────

  public query func adminGetAllUsers(adminUid : Text) : async [UserAdmin] {
    requireAdmin(adminUid);
    users.values()
      .map<User, UserAdmin>(func(u) { userToAdmin(u) })
      .toArray()
  };

  public func adminBanUser(adminUid : Text, targetUid : Text, reason : Text) : async () {
    requireAdmin(adminUid);
    let u = getUser(targetUid);
    users.add(targetUid, { u with isBanned = true; banReason = reason });
  };

  public func adminUnbanUser(adminUid : Text, targetUid : Text) : async () {
    requireAdmin(adminUid);
    let u = getUser(targetUid);
    users.add(targetUid, { u with isBanned = false; banReason = "" });
  };

  public func adminSetKyc(adminUid : Text, targetUid : Text, verified : Bool) : async () {
    requireAdmin(adminUid);
    let u = getUser(targetUid);
    users.add(targetUid, { u with kycVerified = verified });
  };

  public func adminAdjustWallet(adminUid : Text, targetUid : Text, amount : Float, note : Text) : async () {
    requireAdmin(adminUid);
    let u = getUser(targetUid);
    users.add(targetUid, { u with walletBalance = u.walletBalance + amount });
    let txType = if (amount >= 0.0) "bonus" else "entry";
    addTx(targetUid, txType, Float.abs(amount), 0, "approved", "", note);
  };

  public func adminAdjustCoins(adminUid : Text, targetUid : Text, coins : Int) : async () {
    requireAdmin(adminUid);
    let u = getUser(targetUid);
    let newCoins : Nat = if (coins >= 0) {
      u.coins + Int.abs(coins)
    } else {
      let sub = Int.abs(coins);
      if (u.coins >= sub) u.coins - sub else 0
    };
    users.add(targetUid, { u with coins = newCoins });
  };

  public func adminUpdateTransaction(adminUid : Text, txId : Text, status : Text) : async () {
    requireAdmin(adminUid);
    let tx = switch (transactions.get(txId)) {
      case (?x) x;
      case null Runtime.trap("Transaction not found");
    };
    transactions.add(txId, { tx with status });
    if (status == "approved" and tx.txType == "deposit") {
      let u = getUser(tx.uid);
      users.add(tx.uid, { u with walletBalance = u.walletBalance + tx.amount });
    };
    if (status == "rejected" and tx.txType == "withdrawal") {
      let u = getUser(tx.uid);
      users.add(tx.uid, { u with walletBalance = u.walletBalance + tx.amount });
    };
  };

  public query func adminGetAllTransactions(adminUid : Text) : async [Transaction] {
    requireAdmin(adminUid);
    transactions.values().toArray()
  };

  public func adminCreateMatch(
    adminUid      : Text,
    mode          : Text,
    title         : Text,
    entryFee      : Float,
    prizePool     : Float,
    perKill       : Float,
    maxPlayers    : Nat,
    scheduledTime : Text,
  ) : async Text {
    requireAdmin(adminUid);
    matchIdCounter += 1;
    let matchId = genId("match", matchIdCounter);
    matches.add(matchId, {
      id               = matchId;
      mode;
      title;
      entryFee;
      prizePool;
      perKill;
      maxPlayers;
      currentPlayers   = 0;
      status           = "open";
      roomId           = "";
      roomPassword     = "";
      scheduledTime;
      isHidden         = false;
      voiceChannelLink = "";
      joinedPlayers    = [];
      kills            = [];
      winner           = "";
      adminProfit      = 0.0;
      createdAt        = Time.now();
    });
    matchId
  };

  public func adminSetMatchRoom(adminUid : Text, matchId : Text, roomId : Text, roomPassword : Text) : async () {
    requireAdmin(adminUid);
    let m = switch (matches.get(matchId)) {
      case (?x) x;
      case null Runtime.trap("Match not found");
    };
    matches.add(matchId, { m with roomId; roomPassword });
  };

  public func adminUpdateMatchStatus(adminUid : Text, matchId : Text, status : Text) : async () {
    requireAdmin(adminUid);
    let m = switch (matches.get(matchId)) {
      case (?x) x;
      case null Runtime.trap("Match not found");
    };
    matches.add(matchId, { m with status });
  };

  public func adminToggleMatchVisibility(adminUid : Text, matchId : Text) : async () {
    requireAdmin(adminUid);
    let m = switch (matches.get(matchId)) {
      case (?x) x;
      case null Runtime.trap("Match not found");
    };
    matches.add(matchId, { m with isHidden = not m.isHidden });
  };

  public func adminSetVoiceLink(adminUid : Text, matchId : Text, link : Text) : async () {
    requireAdmin(adminUid);
    let m = switch (matches.get(matchId)) {
      case (?x) x;
      case null Runtime.trap("Match not found");
    };
    matches.add(matchId, { m with voiceChannelLink = link });
  };

  public func adminAssignKills(adminUid : Text, matchId : Text, killData : [(Text, Nat)]) : async () {
    requireAdmin(adminUid);
    let m = switch (matches.get(matchId)) {
      case (?x) x;
      case null Runtime.trap("Match not found");
    };
    matches.add(matchId, { m with kills = killData });
    for ((uid, kills) in killData.vals()) {
      switch (users.get(uid)) {
        case (?u) {
          let killEarnings = m.perKill * kills.toFloat();
          users.add(uid, {
            u with
            walletBalance = u.walletBalance + killEarnings;
            totalKills    = u.totalKills + kills;
          });
        };
        case null {};
      };
    };
  };

  public func adminDeclareWinner(adminUid : Text, matchId : Text, winnerUid : Text) : async () {
    requireAdmin(adminUid);
    let m = switch (matches.get(matchId)) {
      case (?x) x;
      case null Runtime.trap("Match not found");
    };
    let prize = m.prizePool * 0.9;
    let newProfit = m.adminProfit + m.prizePool * 0.1;
    matches.add(matchId, { m with winner = winnerUid; status = "completed"; adminProfit = newProfit });
    switch (users.get(winnerUid)) {
      case (?u) {
        users.add(winnerUid, {
          u with
          walletBalance = u.walletBalance + prize;
          totalWins     = u.totalWins + 1;
        });
        addTx(winnerUid, "prize", prize, 0, "approved", "", "Winner prize for match " # matchId);
      };
      case null {};
    };
  };

  public func adminSendMessage(
    adminUid : Text,
    text     : Text,
    category : Text,
    imageUrl : Text,
    isPinned : Bool,
  ) : async Text {
    requireAdmin(adminUid);
    let admin = getUser(adminUid);
    msgIdCounter += 1;
    let msgId = genId("msg", msgIdCounter);
    messages.add(msgId, {
      id         = msgId;
      text;
      senderId   = adminUid;
      senderName = admin.name;
      category;
      isPinned;
      imageUrl;
      reactions  = [];
      createdAt  = Time.now();
    });
    msgId
  };

  public func adminPinMessage(adminUid : Text, msgId : Text, pin : Bool) : async () {
    requireAdmin(adminUid);
    let m = switch (messages.get(msgId)) {
      case (?x) x;
      case null Runtime.trap("Message not found");
    };
    messages.add(msgId, { m with isPinned = pin });
  };

  public func adminCreateTournament(
    adminUid  : Text,
    name      : Text,
    entryFee  : Float,
    prizePool : Float,
    startTime : Int,
  ) : async Text {
    requireAdmin(adminUid);
    tourneyIdCounter += 1;
    let tid = genId("tour", tourneyIdCounter);
    tournaments.add(tid, {
      id                = tid;
      name;
      status            = "open";
      entryFee;
      prizePool;
      registeredPlayers = [];
      startTime;
      winner            = "";
      createdAt         = Time.now();
    });
    tid
  };

  public func adminDeclareTournamentWinner(adminUid : Text, tournamentId : Text, winnerUid : Text) : async () {
    requireAdmin(adminUid);
    let t = switch (tournaments.get(tournamentId)) {
      case (?x) x;
      case null Runtime.trap("Tournament not found");
    };
    tournaments.add(tournamentId, { t with winner = winnerUid; status = "completed" });
    let prize = t.prizePool * 0.9;
    switch (users.get(winnerUid)) {
      case (?u) users.add(winnerUid, { u with walletBalance = u.walletBalance + prize });
      case null {};
    };
  };

  public query func adminGetRevenue(adminUid : Text) : async {
    totalCollected   : Float;
    totalPrizesPaid  : Float;
    netProfit        : Float;
    totalDeposits    : Float;
    totalWithdrawals : Float;
  } {
    requireAdmin(adminUid);
    var totalCollected   : Float = 0.0;
    var totalPrizesPaid  : Float = 0.0;
    var totalDeposits    : Float = 0.0;
    var totalWithdrawals : Float = 0.0;
    var matchProfit      : Float = 0.0;

    for (tx in transactions.values()) {
      if (tx.status == "approved") {
        switch (tx.txType) {
          case "deposit"    { totalDeposits    += tx.amount };
          case "withdrawal" { totalWithdrawals += tx.amount };
          case "entry"      { totalCollected   += tx.amount };
          case "prize"      { totalPrizesPaid  += tx.amount };
          case _            {};
        };
      };
    };

    for (m in matches.values()) {
      matchProfit += m.adminProfit;
    };

    {
      totalCollected;
      totalPrizesPaid;
      netProfit        = matchProfit;
      totalDeposits;
      totalWithdrawals;
    }
  };

  public query func adminGetReports(adminUid : Text) : async [Report] {
    requireAdmin(adminUid);
    reports.toArray()
  };

  public query func adminGetAllMatches(adminUid : Text) : async [Match] {
    requireAdmin(adminUid);
    matches.values().toArray()
  };
};
