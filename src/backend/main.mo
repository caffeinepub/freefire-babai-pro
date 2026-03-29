import Array "mo:core/Array";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Map "mo:core/Map";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import List "mo:core/List";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  type MatchStatus = {
    #waiting;
    #inProgress;
    #completed;
  };

  module MatchStatus {
    public func toText(status : MatchStatus) : Text {
      switch (status) {
        case (#waiting) { "waiting" };
        case (#inProgress) { "inProgress" };
        case (#completed) { "completed" };
      };
    };
  };

  type Match = {
    id : Nat;
    player : Principal;
    status : MatchStatus;
    timestamp : Time.Time;
  };

  module Match {
    public func compare(match1 : Match, match2 : Match) : Order.Order {
      Nat.compare(match1.id, match2.id);
    };
  };

  module UserProfile {
    public func compare(profile1 : UserProfile, profile2 : UserProfile) : Order.Order {
      switch (Text.compare(profile1.username, profile2.username)) {
        case (#equal) { Text.compare(profile1.password, profile2.password) };
        case (order) { order };
      };
    };

    public func compareByWallet(profile1 : UserProfile, profile2 : UserProfile) : Order.Order {
      Nat.compare(profile1.wallet, profile2.wallet);
    };
  };

  public type UserProfile = {
    username : Text;
    password : Text;
    wallet : Nat;
  };

  module WalletTransactionStatus {
    public func toText(status : WalletTransactionStatus) : Text {
      switch (status) {
        case (#approved) { "approved" };
        case (#pending) { "pending" };
        case (#rejected) { "rejected" };
      };
    };
  };

  type WalletTransactionStatus = {
    #approved;
    #pending;
    #rejected;
  };

  module WalletTransaction {
    public func compare(transaction1 : WalletTransaction, transaction2 : WalletTransaction) : Order.Order {
      Nat.compare(transaction1.id, transaction2.id);
    };

    public func compareByStatus(transaction1 : WalletTransaction, transaction2 : WalletTransaction) : Order.Order {
      Text.compare(WalletTransactionStatus.toText(transaction1.status), WalletTransactionStatus.toText(transaction2.status));
    };
  };

  type WalletTransaction = {
    id : Nat;
    user : Principal;
    amount : Nat;
    transactionType : {
      #deposit;
      #withdrawal;
    };
    status : WalletTransactionStatus;
    timestamp : Time.Time;
  };

  var matchIdCounter = 0;
  var transactionIdCounter = 0;

  let matches = Map.empty<Nat, Match>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let walletTransactions = Map.empty<Nat, WalletTransaction>();

  // Helper functions
  func getUserProfileInternal(caller : Principal) : UserProfile {
    switch (userProfiles.get(caller)) {
      case (null) { Runtime.trap("User does not exist") };
      case (?profile) { profile };
    };
  };

  func iterWalletTransactionsByStatus(status : WalletTransactionStatus) : Iter.Iter<WalletTransaction> {
    walletTransactions.values().filter(func(transaction) { transaction.status == status });
  };

  // User Profile Functions
  /// Registers a new user profile with the provided username and password.
  public shared ({ caller }) func register(username : Text, password : Text) : async () {
    if (userProfiles.containsKey(caller)) { Runtime.trap("This user is already registered.") };
    let newProfile : UserProfile = {
      username;
      password;
      wallet = 0;
    };
    userProfiles.add(caller, newProfile);
    // Grant user role in access control
    if (not accessControlState.userRoles.containsKey(caller)) {
      accessControlState.userRoles.add(caller, #user);
    };
  };

  /// Saves the user profile for the caller.
  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  /// Returns the caller's user profile.
  public query ({ caller }) func getCallerUserProfile() : async UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    getUserProfileInternal(caller);
  };

  /// Returns true if the input password matches the user's password.
  public shared ({ caller }) func login(password : Text) : async Bool {
    let profile = getUserProfileInternal(caller);
    let success = profile.password == password;
    // Grant user role retroactively if not already assigned
    if (success and not accessControlState.userRoles.containsKey(caller)) {
      accessControlState.userRoles.add(caller, #user);
    };
    success;
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async UserProfile {
    getUserProfileInternal(user);
  };

  public query ({ caller }) func getUserProfileByUsername(username : Text) : async UserProfile {
    let foundProfile = userProfiles.values().find(func(profile) { profile.username == username });
    switch (foundProfile) {
      case (null) { Runtime.trap("User does not exist") };
      case (?profile) { profile };
    };
  };

  public query ({ caller }) func isRegistered(user : Principal) : async Bool {
    userProfiles.containsKey(user);
  };

  func updateUserWallet(user : Principal, amount : Nat, operation : { #add; #subtract }) {
    let currentProfile = getUserProfileInternal(user);
    let newWalletBalance = switch (operation) {
      case (#add) { currentProfile.wallet + amount };
      case (#subtract) {
        if (currentProfile.wallet >= amount) {
          currentProfile.wallet - amount;
        } else {
          Runtime.trap("Insufficient balance");
        };
      };
    };
    userProfiles.add(user, { currentProfile with wallet = newWalletBalance });
  };

  // Wallet Functions
  public shared ({ caller }) func getWalletBalance() : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access wallet balance");
    };
    getUserProfileInternal(caller).wallet;
  };

  // Game Functions
  public shared ({ caller }) func joinMatch() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can join matches");
    };
    matchIdCounter += 1;
    updateUserWallet(caller, 25, #subtract);

    let newMatch : Match = {
      id = matchIdCounter;
      player = caller;
      status = #waiting;
      timestamp = Time.now();
    };
    matches.add(matchIdCounter, newMatch);
  };

  // Payments Functions
  public shared ({ caller }) func submitPayment(amount : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can submit payments");
    };
    transactionIdCounter += 1;
    let newTransaction : WalletTransaction = {
      id = transactionIdCounter;
      user = caller;
      amount;
      transactionType = #deposit;
      status = #pending;
      timestamp = Time.now();
    };
    walletTransactions.add(transactionIdCounter, newTransaction);
  };

  public query ({ caller }) func getPendingPayments() : async [WalletTransaction] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view pending payments");
    };
    iterWalletTransactionsByStatus(#pending).toArray();
  };

  public query ({ caller }) func getAllWalletTransactions() : async [WalletTransaction] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all transactions");
    };
    walletTransactions.values().toArray();
  };

  public query ({ caller }) func hasUserTransaction(user : Principal, transactionType : { #deposit; #withdrawal }) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can check user transactions");
    };
    walletTransactions.values().find(func(t) { t.user == user and t.transactionType == transactionType }) != null;
  };

  // Withdrawals Functions
  public shared ({ caller }) func requestWithdraw(amount : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can request withdrawals");
    };
    transactionIdCounter += 1;
    if (amount < 100) { Runtime.trap("Minimum withdrawal amount:  100") };

    updateUserWallet(caller, amount, #subtract);

    let newTransaction : WalletTransaction = {
      id = transactionIdCounter;
      user = caller;
      amount;
      transactionType = #withdrawal;
      status = #pending;
      timestamp = Time.now();
    };
    walletTransactions.add(transactionIdCounter, newTransaction);
  };

  public query ({ caller }) func getWithdrawals() : async [WalletTransaction] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view withdrawals");
    };
    iterWalletTransactionsByStatus(#pending).toArray();
  };

  public shared ({ caller }) func updateWalletTransactionStatus(transactionId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can approve transactions");
    };
    switch (walletTransactions.get(transactionId)) {
      case (?existingTransaction) {
        let updatedTransaction = {
          existingTransaction with
          status = #approved
        };
        walletTransactions.add(transactionId, updatedTransaction);

        // Credit coins to user wallet if it's a deposit
        if (existingTransaction.transactionType == #deposit) {
          updateUserWallet(existingTransaction.user, existingTransaction.amount, #add);
        };
      };
      case (null) { ();
        Runtime.trap("Transaction does not exist!") };
    };
  };

  public query ({ caller }) func getMatches() : async [Match] {
    matches.values().toArray().sort();
  };

  public query ({ caller }) func getAllUsers() : async [UserProfile] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all users");
    };
    userProfiles.values().toArray().sort();
  };

  public query ({ caller }) func getAllUsersWithWalletOver(amount : Nat) : async [UserProfile] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view user analytics");
    };
    userProfiles.values().filter(func(profile) { profile.wallet > amount }).toArray().sort();
  };

  public query ({ caller }) func getUsersSortedByWallet() : async [UserProfile] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view user analytics");
    };
    userProfiles.values().toArray().sort(UserProfile.compareByWallet);
  };
};
