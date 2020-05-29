const { schema: userSchema } = require("../../lib/models/User");
const {
  schema: individualUserSchema,
} = require("../../lib/models/IndividualUser");
const {
  schema: organizationUserSchema,
} = require("../../lib/models/OrganizationUser");

const SOURCED_BY_FP_OWNER_FILTER = {
  // don't update email post-launch
  email: "sourcedby@fightpandemics.com",
};

const SOURCED_BY_FP_OWNER_UPDATE = {
  // can be updated post-launch
  about: "For posts sourced by FightPandemics",
  authId: "NA",
  firstName: "Sourced by",
  lastName: "FightPandemics",
};

const SOURCED_BY_FP_ORG_UPDATE = {
  global: true,
  industry: "Non-profit",
  language: "English",
};

const initSourcedByFPOwner = async (connection) => {
  const User = connection.model("User", userSchema);
  const IndividualUser = User.discriminator(
    "IndividualUser",
    individualUserSchema,
  );
  const sourcedByFPOwner = await IndividualUser.findOne(
    SOURCED_BY_FP_OWNER_FILTER,
  );

  if (sourcedByFPOwner) {
    // already exists? update & return id
    Object.keys(SOURCED_BY_FP_OWNER_UPDATE).forEach((key) => {
      if (sourcedByFPOwner[key] !== SOURCED_BY_FP_OWNER_UPDATE[key]) {
        sourcedByFPOwner[key] = SOURCED_BY_FP_OWNER_UPDATE[key];
      }
    });
    return sourcedByFPOwner.save();
  }

  return new IndividualUser({
    ...SOURCED_BY_FP_OWNER_FILTER,
    ...SOURCED_BY_FP_OWNER_UPDATE,
  }).save();
};

// Returns [{ type: OrgDoc }] to associate posts with the correct author.type
const initSourcedByFPOrgs = async (connection, sourcedByFPOwner) => {
  const User = connection.model("User", userSchema);
  const OrganizationUser = User.discriminator(
    "OrganizationUser",
    organizationUserSchema,
  );

  /*
    Need to create one Sourced by FP Org per organization.type enum
    Since all post author.type references updated whenver the author type is updated
  */
  const fpOrgsByType = {};
  /* eslint-disable-next-line no-restricted-syntax */
  for await (const orgType of organizationUserSchema.tree.type.enum) {
    const orgFilter = {
      ownerId: sourcedByFPOwner._id,
      type: orgType,
    };
    const orgUpdate = {
      ...SOURCED_BY_FP_ORG_UPDATE,
      email: `${orgType}+${sourcedByFPOwner.email}`,
      name: `${sourcedByFPOwner.name} - ${orgType}`,
    };

    let sourcedByFPOrg;
    sourcedByFPOrg = await OrganizationUser.findOne(orgFilter);
    if (sourcedByFPOrg) {
      Object.keys(orgUpdate).forEach((key) => {
        if (sourcedByFPOrg[key] !== orgUpdate[key]) {
          sourcedByFPOrg[key] = orgUpdate[key];
        }
      });
      await sourcedByFPOrg.save();
    } else {
      sourcedByFPOrg = await new OrganizationUser({
        ...orgFilter,
        ...orgUpdate,
      }).save();
    }
    fpOrgsByType[orgType] = sourcedByFPOrg;
  }
  return fpOrgsByType;
};

module.exports = async (connection) => {
  const sourcedByFPOwner = await initSourcedByFPOwner(connection);
  return initSourcedByFPOrgs(connection, sourcedByFPOwner);
};
