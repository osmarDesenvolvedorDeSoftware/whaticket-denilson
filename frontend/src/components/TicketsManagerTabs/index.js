import React, { useState, useEffect, useContext, useRef } from "react";
import { useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { useHistory } from "react-router-dom";
import {
  makeStyles,
  Paper,
  InputBase,
  Tabs,
  Tab,
  Badge,
  IconButton,
  Typography,
  Grid,
  Tooltip,
  Switch,
} from "@material-ui/core";
import {
  Group,
  MoveToInbox as MoveToInboxIcon,
  CheckBox as CheckBoxIcon,
  MessageSharp as MessageSharpIcon,
  AccessTime as ClockIcon,
  Search as SearchIcon,
  Add as AddIcon,
  TextRotateUp,
  TextRotationDown,
  Android as AndroidIcon,
} from "@material-ui/icons";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";
import ToggleButton from "@material-ui/lab/ToggleButton";

import { FilterAltOff, FilterAlt, PlaylistAddCheckOutlined } from "@mui/icons-material";

import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsListCustom";
import TabPanel from "../TabPanel";
import { Can } from "../Can";
import TicketsQueueSelect from "../TicketsQueueSelect";
import { TagsFilter } from "../TagsFilter";
import { UsersFilter } from "../UsersFilter";
import { StatusFilter } from "../StatusFilter";
import { WhatsappsFilter } from "../WhatsappsFilter";
import { Button, Snackbar } from "@material-ui/core";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { QueueSelectedContext } from "../../context/QueuesSelected/QueuesSelectedContext";

import api from "../../services/api";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

const useStyles = makeStyles((theme) => ({
  ticketsWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },

  tabsHeader: {
    minWidth: "auto",
    width: "auto",
    borderRadius: 8,
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
  },

  settingsIcon: {
    alignSelf: "center",
    marginLeft: "auto",
    padding: theme.spacing(1),
  },

  tab: {
    minWidth: "auto",
    width: "auto",
    padding: theme.spacing(0.5, 1),
    borderRadius: 8,
    transition: "0.3s",
    borderColor: "#aaa",
    borderWidth: "1px",
    borderStyle: "solid",
    marginRight: theme.spacing(0.5),
    marginLeft: theme.spacing(0.5),

    [theme.breakpoints.down("lg")]: {
      fontSize: "0.9rem",
      padding: theme.spacing(0.4, 0.8),
      marginRight: theme.spacing(0.4),
      marginLeft: theme.spacing(0.4),
    },

    [theme.breakpoints.down("md")]: {
      fontSize: "0.75rem",
      padding: theme.spacing(0.25, 0.5),
      marginRight: theme.spacing(0.25),
      marginLeft: theme.spacing(0.25),
    },

    // Específico para monitores de 11-13 polegadas
    '@media (max-width: 1366px)': {
      fontSize: "0.8rem",
      padding: theme.spacing(0.3, 0.6),
      marginRight: theme.spacing(0.3),
      marginLeft: theme.spacing(0.3),
    },

    "&:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.1)",
    },
  },

  tabPanelItem: {
    minWidth: "25%",
    flex: 1,
    maxWidth: "none",
    fontSize: 14,
    minHeight: 46,
    marginLeft: 0,
    transition: "all 0.3s ease",
    fontWeight: 500,
    borderRadius: "8px",
    margin: "0 4px",
    opacity: 0.7,
    whiteSpace: "nowrap",
    "&.Mui-selected": {
      opacity: 1,
      backgroundColor: theme.mode === "light" ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.1)",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
    },
    "&:hover": {
      opacity: 1,
      backgroundColor: theme.mode === "light" ? "rgba(0, 0, 0, 0.03)" : "rgba(255, 255, 255, 0.05)",
    },
    [theme.breakpoints.down('sm')]: {
      minWidth: "28%",
      flex: "unset",
      fontSize: 13,
      padding: theme.spacing(0.5),
    },
    [theme.breakpoints.down('xs')]: {
      minWidth: "26%",
      fontSize: 12,
    },
  },

  tabIndicator: {
    height: 3,
    bottom: 0,
    borderRadius: "3px 3px 0 0",
    backgroundColor: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    transition: "all 0.3s ease",
  },
  tabsBadge: {
    top: "105%",
    right: "55%",
    transform: "translate(45%, 0)",
    whiteSpace: "nowrap",
    borderRadius: "12px",
    padding: "0 8px",
    backgroundColor: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    color: theme.mode === "light" ? "#FFF" : theme.palette.primary.main,
  },
  tabsBadgeAwaiting: {
    top: "105%",
    right: "55%",
    transform: "translate(45%, 0)",
    whiteSpace: "nowrap",
    borderRadius: "12px",
    padding: "0 6px",
    backgroundColor: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    color: theme.mode === "light" ? "#FFF" : theme.palette.primary.main,
    fontSize: "0.65rem",
  },
  ticketOptionsBox: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    background: theme.palette.optionsBackground,
    borderRadius: 8,
    borderColor: "#aaa",
    borderWidth: "1px",
    borderStyle: "solid",
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    padding: theme.spacing(0.25),
    flexWrap: "wrap",
    rowGap: theme.spacing(0.5),
    columnGap: theme.spacing(0.5),
  },

  serachInputWrapper: {
    flex: 1,
    height: 40,
    background: theme.palette.total,
    display: "flex",
    borderRadius: 40,
    padding: 4,
    borderColor: "#aaa",
    borderWidth: "1px",
    borderStyle: "solid",
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
  },

  searchIcon: {
    color: "grey",
    marginLeft: 6,
    marginRight: 6,
    alignSelf: "center",
  },

  searchInput: {
    flex: 1,
    border: "none",
    borderRadius: 30,
  },

  badge: {
    // right: "-10px",
  },

  customBadge: {
    right: "-12px",
    top: "-10px",
    transform: "translate(30%, -30%)",
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    borderRadius: "10px",
    padding: "0 6px",
    fontWeight: "bold",
    fontSize: "0.75rem",
    minWidth: "20px",
    height: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
  },
  
  modernTabs: {
    minHeight: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: theme.mode === "light" ? "rgba(0, 0, 0, 0.02)" : "rgba(255, 255, 255, 0.02)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    padding: "6px 4px 4px 4px", // Ajuste para aproximar do topo
    margin: "8px 0",
    transition: "all 0.3s ease",
    position: "relative",
    overflowX: "auto",
    overflowY: "hidden",
    "& .MuiTabs-scroller": {
      overflowY: "hidden !important",
    },
    "& .MuiTabs-flexContainer": {
      flexWrap: "nowrap",
      alignItems: "center",
      justifyContent: "center",
    },
  },

  show: {
    display: "block",
  },

  hide: {
    display: "none !important",
  },

  closeAllFab: {
    backgroundColor: "red",
    marginBottom: "4px",
    "&:hover": {
      backgroundColor: "darkred",
    },
  },

  speedDial: {
    position: "absolute",
    bottom: theme.spacing(1),
    right: theme.spacing(1),
    "& .MuiFab-root": {
      width: "40px",
      height: "40px",
      marginTop: "4px",
    },
    "& .MuiFab-label": {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
  },

  snackbar: {
    display: "flex",
    justifyContent: "space-between",
    backgroundColor: theme.palette.primary.main,
    color: "white",
    borderRadius: 30,
    [theme.breakpoints.down("sm")]: {
      fontSize: "0.8em",
    },
    [theme.breakpoints.up("md")]: {
      fontSize: "1em",
    },
  },

  yesButton: {
    backgroundColor: "#FFF",
    color: "rgba(0, 100, 0, 1)",
    padding: "4px 4px",
    fontSize: "1em",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginRight: theme.spacing(1),
    "&:hover": {
      backgroundColor: "darkGreen",
      color: "#FFF",
    },
    borderRadius: 30,
  },
  noButton: {
    backgroundColor: "#FFF",
    color: "rgba(139, 0, 0, 1)",
    padding: "4px 4px",
    fontSize: "1em",
    fontWeight: "bold",
    textTransform: "uppercase",
    "&:hover": {
      backgroundColor: "darkRed",
      color: "#FFF",
    },
    borderRadius: 30,
  },
  filterIcon: {
    marginRight: 6,
    alignSelf: "center",
    color: theme.mode === "light" ? "#0872b9" : "#FFF",
    cursor: "pointer",
  },
  button: {
    height: 30,
    width: 30,
    border: "2px solid",
    borderColor: "#aaa",
    borderRadius: 8,
    marginRight: 8,
    "&:hover": {
      borderColor: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    },
  },
  icon: {
    color: "#aaa",
    "&:hover": {
      color: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    },
  },
  buttonOpen: {
    "& $icon": {
      color: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    },
  },
  // Classe padronizada para todos os botões de ação
  standardButton: {
    height: 30,
    width: 30,
    border: "2px solid #aaa",
    borderRadius: 8,
    marginRight: 8,
    padding: 0,
    minWidth: 'auto',
    "&:hover": {
      borderColor: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    },
    [theme.breakpoints.down('sm')]: {
      height: 28,
      width: 28,
      marginRight: 6,
    },
    // Ajuste para monitores pequenos (11-13 polegadas)
    '@media (max-width: 1366px)': {
      height: 28,
      width: 28,
      marginRight: 6,
    },
  },
  activeButton: {
    borderColor: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    borderWidth: "3px",
  },
  standardIcon: {
    color: "#aaa",
    fontSize: 21,
    "&:hover": {
      color: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    },
    [theme.breakpoints.down('sm')]: {
      fontSize: 19,
    },
  },
  awaitingSmallButton: {
    height: 30,
    width: 30,
    border: "2px solid #aaa",
    borderRadius: 8,
    marginRight: 6,
    padding: 0,
    minWidth: 'auto',
    "&:hover": {
      borderColor: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    },
    [theme.breakpoints.down('sm')]: {
      height: 28,
      width: 28,
    },
  },
  awaitingSmallIcon: {
    color: "#aaa",
    fontSize: 20,
    "&:hover": {
      color: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    },
    [theme.breakpoints.down('sm')]: {
      fontSize: 19,
    },
  },
  activeIcon: {
    color: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
  },
}));

const TicketsManagerTabs = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const classes = useStyles();
  const history = useHistory();

  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const [sortTickets, setSortTickets] = useState(false);

  const searchInputRef = useRef();
  const [searchOnMessages, setSearchOnMessages] = useState(false);

  const { user } = useContext(AuthContext);
  const { profile } = user;
  const { setSelectedQueuesMessage } = useContext(QueueSelectedContext);
  const { tabOpen, setTabOpen } = useContext(TicketsContext);

  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [groupingCount, setGroupingCount] = useState(0);
  const [awaitingAgentCount, setAwaitingAgentCount] = useState(0);
  const [awaitingCustomerCount, setAwaitingCustomerCount] = useState(0);

  const userQueueIds = user.queues.map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedWhatsapp, setSelectedWhatsapp] = useState([]);
  const [forceSearch, setForceSearch] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [filter, setFilter] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [isHoveredAll, setIsHoveredAll] = useState(false);
  const [isHoveredNew, setIsHoveredNew] = useState(false);
  const [isHoveredResolve, setIsHoveredResolve] = useState(false);
  const [isHoveredOpen, setIsHoveredOpen] = useState(false);
  const [isHoveredClosed, setIsHoveredClosed] = useState(false);
  const [isHoveredSort, setIsHoveredSort] = useState(false);
  const [isHoveredAwaitingAgent, setIsHoveredAwaitingAgent] = useState(false);
  const [isHoveredAwaitingCustomer, setIsHoveredAwaitingCustomer] = useState(false);

  const [isFilterActive, setIsFilterActive] = useState(false);

  const showAllStorageKey = `ticketsShowAll-${user?.companyId}-${user?.id}`;

  useEffect(() => {
    const stored = localStorage.getItem(showAllStorageKey);
    if (stored === "true") {
      setShowAllTickets(true);
    }
  }, [showAllStorageKey]);

  useEffect(() => {
    localStorage.setItem(showAllStorageKey, showAllTickets ? "true" : "false");
  }, [showAllTickets, showAllStorageKey]);

  useEffect(() => {
    setSelectedQueuesMessage(selectedQueueIds);
  }, [selectedQueueIds]);

  useEffect(() => {
    const canShowAll =
      user.profile.toUpperCase() === "ADMIN" ||
      user.allUserChat.toUpperCase() === "ENABLED";
    if (!canShowAll) {
      setShowAllTickets(false);
    }
  }, [user.profile, user.allUserChat]);

  useEffect(() => {
    if (tab === "search") {
      searchInputRef.current.focus();
    }
    setForceSearch(!forceSearch);
  }, [tab]);

  let searchTimeout;

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    if (searchedTerm === "") {
      setSearchParam(searchedTerm);
      setForceSearch(!forceSearch);
      setTab("open");
      return;
    } else if (tab !== "search") {
      handleFilter();
      setTab("search");
    }

    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
      setForceSearch(!forceSearch);
    }, 500);
  };

  const handleBack = () => {
    history.push("/tickets");
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    handleBack();
    setTabOpen(newValue);
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };

  const handleSnackbarOpen = () => {
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const CloseAllTicket = async () => {
    try {
      const { data } = await api.post("/tickets/closeAll", {
        status: tabOpen,
        selectedQueueIds,
      });
      handleSnackbarClose();
    } catch (err) {
      console.log("Error: ", err);
    }
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);

    clearTimeout(searchTimeout);

    if (tags.length === 0) {
      setForceSearch(!forceSearch);
    } else if (tab !== "search") {
      setTab("search");
    }

    searchTimeout = setTimeout(() => {
      setSelectedTags(tags);
      setForceSearch(!forceSearch);
    }, 500);
  };

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);

    clearTimeout(searchTimeout);

    if (users.length === 0) {
      setForceSearch(!forceSearch);
    } else if (tab !== "search") {
      setTab("search");
    }
    searchTimeout = setTimeout(() => {
      setSelectedUsers(users);
      setForceSearch(!forceSearch);
    }, 500);
  };

  const handleSelectedWhatsapps = (selecteds) => {
    const whatsapp = selecteds.map((t) => t.id);

    clearTimeout(searchTimeout);

    if (whatsapp.length === 0) {
      setForceSearch(!forceSearch);
    } else if (tab !== "search") {
      setTab("search");
    }
    searchTimeout = setTimeout(() => {
      setSelectedWhatsapp(whatsapp);
      setForceSearch(!forceSearch);
    }, 500);
  };

  const handleSelectedStatus = (selecteds) => {
    const statusFilter = selecteds.map((t) => t.status);

    clearTimeout(searchTimeout);

    if (statusFilter.length === 0) {
      setForceSearch(!forceSearch);
    } else if (tab !== "search") {
      setTab("search");
    }

    searchTimeout = setTimeout(() => {
      setSelectedStatus(statusFilter);
      setForceSearch(!forceSearch);
    }, 500);
  };

  const handleFilter = () => {
    if (filter) {
      setFilter(false);
      setTab("open");
      setSearchParam("");
      setSelectedTags([]);
      setSelectedUsers([]);
      setSelectedWhatsapp([]);
      setSelectedStatus([]);
      setForceSearch(!forceSearch);
      if (searchInputRef.current) {
        searchInputRef.current.value = "";
      }
    } else {
      setFilter(true);
      setTab("search");
    }
  };

  const [open, setOpen] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  const handleVisibility = () => {
    setHidden((prevHidden) => !prevHidden);
  };

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClosed = () => {
    setOpen(false);
  };

  const tooltipTitleStyle = {
    fontSize: "10px",
  };

  return (
    <Paper elevation={0} variant="outlined" className={classes.ticketsWrapper}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={(ticket) => {
          handleCloseOrOpenTicket(ticket);
        }}
      />
      <div className={classes.serachInputWrapper}>
        <SearchIcon className={classes.searchIcon} />
        <InputBase
          className={classes.searchInput}
          inputRef={searchInputRef}
          placeholder={i18n.t("tickets.search.placeholder")}
          type="search"
          onChange={handleSearch}
        />
        <Tooltip placement="top" title="Marque para pesquisar também nos conteúdos das mensagens (mais lento)">
          <div>
            <Switch
              size="small"
              checked={searchOnMessages}
              onChange={(e) => { setSearchOnMessages(e.target.checked) }}
            />
          </div>
        </Tooltip>
        <IconButton
          style={{
            backgroundColor: "transparent",
            boxShadow: "none",
            border: "none",
            borderRadius: "50%",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
          variant="contained"
          aria-label="filter"
          className={classes.filterIcon}
          onClick={() => {
            setIsFilterActive((prevState) => !prevState);
            handleFilter();
          }}
        >
          {isFilterActive ? (
            <FilterAlt className={classes.icon} />
          ) : (
            <FilterAltOff className={classes.icon} />
          )}
        </IconButton>
      </div>

      {filter === true && (
        <>
          <TagsFilter onFiltered={handleSelectedTags} />
          <WhatsappsFilter onFiltered={handleSelectedWhatsapps} />
          <StatusFilter onFiltered={handleSelectedStatus} />
          {profile === "admin" && (
            <>
              <UsersFilter onFiltered={handleSelectedUsers} />
            </>
          )}
        </>
      )}

      <Paper square elevation={0} className={classes.ticketOptionsBox}>
        <Grid container alignItems="center">
          <Grid item>
            <Can
              role={user.allUserChat === 'enabled' && user.profile === 'user' ? 'admin' : user.profile}
              perform="tickets-manager:showall"
              yes={() => (
<Tooltip title={showAllTickets ? "Ocultar todos" : "Mostrar todos"}>
  <Badge
    color="primary"
    invisible={
      !isHoveredAll ||
      isHoveredNew ||
      isHoveredResolve ||
      isHoveredOpen ||
      isHoveredClosed
    }
    badgeContent={"Todos"}
    classes={{ badge: classes.tabsBadge }}
  >
    <ToggleButton
      onMouseEnter={() => setIsHoveredAll(true)}
      onMouseLeave={() => setIsHoveredAll(false)}
      className={`${classes.standardButton} ${showAllTickets ? classes.activeButton : ''}`}
      value="uncheck"
      selected={showAllTickets}
      onChange={() => setShowAllTickets((prevState) => !prevState)}
    >
      {showAllTickets ? (
        <VisibilityIcon className={`${classes.standardIcon} ${classes.activeIcon}`} />
      ) : (
        <VisibilityOffIcon className={classes.standardIcon} />
      )}
    </ToggleButton>
  </Badge>
</Tooltip>
              )}
            />
            <Snackbar
              open={snackbarOpen}
              onClose={handleSnackbarClose}
              message={i18n.t("tickets.inbox.closedAllTickets")}
              ContentProps={{
                className: classes.snackbar,
              }}
              action={
                <>
                  <Button
                    className={classes.yesButton}
                    size="small"
                    onClick={CloseAllTicket}
                  >
                    {i18n.t("tickets.inbox.yes")}
                  </Button>
                  <Button
                    className={classes.noButton}
                    size="small"
                    onClick={handleSnackbarClose}
                  >
                    {i18n.t("tickets.inbox.no")}
                  </Button>
                </>
              }
            />
<Tooltip title={i18n.t("tickets.inbox.newTicket")}>
  <Badge
    color="primary"
    invisible={
      isHoveredAll ||
      !isHoveredNew ||
      isHoveredResolve ||
      isHoveredOpen ||
      isHoveredClosed
    }
    badgeContent={i18n.t("tickets.inbox.newTicket")}
    classes={{ badge: classes.tabsBadge }}
  >
    <IconButton
      onMouseEnter={() => setIsHoveredNew(true)}
      onMouseLeave={() => setIsHoveredNew(false)}
      className={classes.standardButton}
      onClick={() => {
        setNewTicketModalOpen(true);
      }}
    >
      <AddIcon className={classes.standardIcon} />
    </IconButton>
  </Badge>
</Tooltip>
{user.profile === "admin" && (
  <Tooltip title={i18n.t("tickets.inbox.closedAll")}>
    <Badge
      color="primary"
      invisible={
        isHoveredAll ||
        isHoveredNew ||
        !isHoveredResolve ||
        isHoveredOpen ||
        isHoveredClosed
      }
      badgeContent={i18n.t("tickets.inbox.closedAll")}
      classes={{ badge: classes.tabsBadge }}
    >
      <IconButton
        onMouseEnter={() => setIsHoveredResolve(true)}
        onMouseLeave={() => setIsHoveredResolve(false)}
        className={classes.standardButton}
        onClick={handleSnackbarOpen}
      >
        <PlaylistAddCheckOutlined className={classes.standardIcon} />
      </IconButton>
    </Badge>
  </Tooltip>
)}
{/* Botão "Abertos" */}
<Tooltip title={i18n.t("tickets.inbox.open")}>
  <Badge
    invisible={
      !(
        tab === "open" &&
        !isHoveredAll &&
        !isHoveredNew &&
        !isHoveredResolve &&
        !isHoveredClosed &&
        !isHoveredSort
      ) && !isHoveredOpen
    }
    badgeContent={i18n.t("tickets.inbox.open")}
    classes={{ badge: classes.tabsBadge }}
  >
    <IconButton
      onMouseEnter={() => {
        setIsHoveredOpen(true);
        setHoveredButton("open");
      }}
      onMouseLeave={() => {
        setIsHoveredOpen(false);
        setHoveredButton(null);
      }}
      className={`${classes.standardButton} ${
        (tab === "open" || isHoveredOpen) ? classes.activeButton : ''
      }`}
      onClick={() => handleChangeTab(null, "open")}
    >
      <MoveToInboxIcon
        className={`${classes.standardIcon} ${
          (tab === "open" || isHoveredOpen) ? classes.activeIcon : ''
        }`}
      />
    </IconButton>
  </Badge>
</Tooltip>

{/* Botão "Resolvidos" */}
<Tooltip title={i18n.t("tickets.inbox.resolverd")}>
  <Badge
    color="primary"
    invisible={
      !(
        tab === "closed" &&
        !isHoveredAll &&
        !isHoveredNew &&
        !isHoveredResolve &&
        !isHoveredOpen &&
        !isHoveredSort
      ) && !isHoveredClosed
    }
    badgeContent={i18n.t("tickets.inbox.resolverd")}
    classes={{ badge: classes.tabsBadge }}
  >
    <IconButton
      onMouseEnter={() => {
        setIsHoveredClosed(true);
        setHoveredButton("closed");
      }}
      onMouseLeave={() => {
        setIsHoveredClosed(false);
        setHoveredButton(null);
      }}
      className={`${classes.standardButton} ${
        (tab === "closed" || isHoveredClosed) ? classes.activeButton : ''
      }`}
      onClick={() => handleChangeTab(null, "closed")}
    >
      <CheckBoxIcon
        className={`${classes.standardIcon} ${
          (tab === "closed" || isHoveredClosed) ? classes.activeIcon : ''
        }`}
      />
    </IconButton>
  </Badge>
</Tooltip>

{tab !== "closed" && tab !== "search" && (
  <Tooltip title={!sortTickets ? "Ordenação crescente" : "Ordenação decrescente"}>
    <Badge
      color="primary"
      invisible={
        !isHoveredSort ||
        isHoveredAll ||
        isHoveredNew ||
        isHoveredResolve ||
        isHoveredOpen ||
        isHoveredClosed
      }
      badgeContent={!sortTickets ? "Crescente" : "Decrescente"}
      classes={{ badge: classes.tabsBadge }}
    >
      <ToggleButton
        onMouseEnter={() => setIsHoveredSort(true)}
        onMouseLeave={() => setIsHoveredSort(false)}
        className={`${classes.standardButton} ${sortTickets ? classes.activeButton : ''}`}
        value="uncheck"
        selected={sortTickets}
        onChange={() => setSortTickets((prevState) => !prevState)}
      >
        {!sortTickets ? (
          <TextRotateUp className={`${classes.standardIcon} ${sortTickets ? classes.activeIcon : ''}`} />
        ) : (
          <TextRotationDown className={`${classes.standardIcon} ${classes.activeIcon}`} />
        )}
      </ToggleButton>
    </Badge>
  </Tooltip>
)}

<Tooltip title="Atendente aguardando">
    <Badge
      color="primary"
      invisible={
        !(
          (tabOpen === "awaiting_agent" &&
            !isHoveredAll &&
            !isHoveredNew &&
            !isHoveredResolve &&
            !isHoveredOpen &&
            !isHoveredClosed &&
            !isHoveredSort &&
            !isHoveredAwaitingCustomer
          ) || isHoveredAwaitingAgent
        )
      }
      badgeContent={"Ag. Atend."}
      classes={{ badge: classes.tabsBadgeAwaiting }}
    >
      <IconButton
        onMouseEnter={() => setIsHoveredAwaitingAgent(true)}
        onMouseLeave={() => setIsHoveredAwaitingAgent(false)}
        className={`${classes.awaitingSmallButton} ${
          tabOpen === "awaiting_agent" ? classes.activeButton : ''
        }`}
        onClick={() => setTabOpen("awaiting_agent")}
      >
        <ClockIcon
          className={`${classes.awaitingSmallIcon} ${
            tabOpen === "awaiting_agent" ? classes.activeIcon : ''
          }`}
        />
      </IconButton>
    </Badge>
</Tooltip>
<Tooltip title="Cliente aguardando">
    <Badge
      color="primary"
      invisible={
        !(
          (tabOpen === "awaiting_customer" &&
            !isHoveredAll &&
            !isHoveredNew &&
            !isHoveredResolve &&
            !isHoveredOpen &&
            !isHoveredClosed &&
            !isHoveredSort &&
            !isHoveredAwaitingAgent
          ) || isHoveredAwaitingCustomer
        )
      }
      badgeContent={"Ag. Cliente"}
      classes={{ badge: classes.tabsBadgeAwaiting }}
    >
      <IconButton
        onMouseEnter={() => setIsHoveredAwaitingCustomer(true)}
        onMouseLeave={() => setIsHoveredAwaitingCustomer(false)}
        className={`${classes.awaitingSmallButton} ${
          tabOpen === "awaiting_customer" ? classes.activeButton : ''
      }`}
      onClick={() => setTabOpen("awaiting_customer")}
    >
      <MessageSharpIcon
        className={`${classes.awaitingSmallIcon} ${
          tabOpen === "awaiting_customer" ? classes.activeIcon : ''
        }`}
      />
    </IconButton>
  </Badge>
</Tooltip>

{/* Movido o seletor de filas para a mesma linha dos botões */}
<span className="MuiBadge-root">
  <TicketsQueueSelect
    selectedQueueIds={selectedQueueIds}
    userQueues={user?.queues}
    onChange={(values) => setSelectedQueueIds(values)}
  />
</span>
          </Grid>
        </Grid>
      </Paper>

      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        <Tabs
          value={["open", "pending", "group"].includes(tabOpen) ? tabOpen : "open"}
          onChange={handleChangeTabOpen}
          indicatorColor="primary"
          textColor="primary"
          variant={isMobile ? "scrollable" : "fullWidth"}
          scrollButtons={isMobile ? "auto" : "off"}
          allowScrollButtonsMobile
          centered={isMobile}
          TabIndicatorProps={{ className: classes.tabIndicator }}
          className={classes.modernTabs}
        >
          {/* ATENDENDO */}
          <Tab
            label={
              <Grid container alignItems="center" justifyContent="center" style={{ position: "relative", paddingTop: 6 }}>
                <Grid item>
                  <Badge
                    overlap="circular"
                    max={999}
                    classes={{ badge: classes.customBadge }}
                    badgeContent={openCount}
                    color="primary"
                  >
                    <MessageSharpIcon
                      style={{
                        fontSize: 24,
                        color: tabOpen === "open" ? theme.palette.primary.main : "inherit",
                      }}
                    />
                  </Badge>
                </Grid>
                <Grid item>
                  <Typography
                    style={{
                      marginLeft: 8,
                      fontSize: isMobile ? 13 : 14,
                      fontWeight: tabOpen === "open" ? 700 : 500,
                      color: tabOpen === "open" ? theme.palette.primary.main : "inherit",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {i18n.t("ticketsList.assignedHeader")}
                  </Typography>
                </Grid>
              </Grid>
            }
            value={"open"}
            name="open"
            classes={{ root: classes.tabPanelItem }}
          />

          {/* AGUARDANDO */}
          <Tab
            label={
              <Grid container alignItems="center" justifyContent="center" style={{ position: "relative", paddingTop: 6 }}>
                <Grid item>
                  <Badge
                    overlap="circular"
                    max={999}
                    classes={{ badge: classes.customBadge }}
                    badgeContent={pendingCount}
                    color="primary"
                  >
                    <ClockIcon
                      style={{
                        fontSize: 24,
                        color: tabOpen === "pending" ? theme.palette.primary.main : "inherit",
                      }}
                    />
                  </Badge>
                </Grid>
                <Grid item>
                  <Typography
                    style={{
                      marginLeft: 8,
                      fontSize: isMobile ? 13 : 14,
                      fontWeight: tabOpen === "pending" ? 700 : 500,
                      color: tabOpen === "pending" ? theme.palette.primary.main : "inherit",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {i18n.t("ticketsList.pendingHeader")}
                  </Typography>
                </Grid>
              </Grid>
            }
            value={"pending"}
            name="pending"
            classes={{ root: classes.tabPanelItem }}
          />

          {/* GRUPOS */}
          {user.allowGroup && (
            <Tab
              label={
                <Grid container alignItems="center" justifyContent="center" style={{ position: "relative", paddingTop: 6 }}>
                  <Grid item>
                    <Badge
                      overlap="circular"
                      max={999}
                      classes={{ badge: classes.customBadge }}
                      badgeContent={groupingCount}
                      color="primary"
                    >
                      <Group
                        style={{
                          fontSize: 24,
                          color: tabOpen === "group" ? theme.palette.primary.main : "inherit",
                        }}
                      />
                    </Badge>
                  </Grid>
                  <Grid item>
                    <Typography
                        style={{
                          marginLeft: 8,
                      fontSize: isMobile ? 13 : 14,
                          fontWeight: tabOpen === "group" ? 700 : 500,
                          color: tabOpen === "group" ? theme.palette.primary.main : "inherit",
                          transition: "all 0.2s ease",
                        }}
                    >
                      {i18n.t("ticketsList.groupingHeader")}
                    </Typography>
                  </Grid>
                </Grid>
              }
              value={"group"}
              name="group"
              classes={{ root: classes.tabPanelItem }}
            />
          )}
        </Tabs>

        <Paper className={classes.ticketsWrapper}>
          <TicketsList
            status="open"
            showAll={showAllTickets}
            sortTickets={sortTickets ? "ASC" : "DESC"}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setOpenCount(val)}
            style={applyPanelStyle("open")}
            setTabOpen={setTabOpen}
          />
          <TicketsList
            status="pending"
            selectedQueueIds={selectedQueueIds}
            sortTickets={sortTickets ? "ASC" : "DESC"}
            showAll={user.profile === "admin" || user.allUserChat === 'enabled' ? showAllTickets : false}
            updateCount={(val) => setPendingCount(val)}
            style={applyPanelStyle("pending")}
            setTabOpen={setTabOpen}
          />
          <TicketsList
            status="open"
            awaiting="agent"
            showAll={showAllTickets}
            sortTickets={sortTickets ? "ASC" : "DESC"}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setAwaitingAgentCount(val)}
            style={applyPanelStyle("awaiting_agent")}
            setTabOpen={setTabOpen}
          />
          <TicketsList
            status="open"
            awaiting="customer"
            showAll={showAllTickets}
            sortTickets={sortTickets ? "ASC" : "DESC"}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setAwaitingCustomerCount(val)}
            style={applyPanelStyle("awaiting_customer")}
            setTabOpen={setTabOpen}
          />
          {user.allowGroup && (
            <TicketsList
              status="group"
              showAll={showAllTickets}
              sortTickets={sortTickets ? "ASC" : "DESC"}
              selectedQueueIds={selectedQueueIds}
              updateCount={(val) => setGroupingCount(val)}
              style={applyPanelStyle("group")}
              setTabOpen={setTabOpen}
            />
          )}
        </Paper>
      </TabPanel>

      <TabPanel value={tab} name="closed" className={classes.ticketsWrapper}>
        <TicketsList
          status="closed"
          showAll={showAllTickets}
          selectedQueueIds={selectedQueueIds}
          setTabOpen={setTabOpen}
        />
      </TabPanel>

      <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        {profile === "admin" && (
          <>
            <TicketsList
              statusFilter={selectedStatus}
              searchParam={searchParam}
              showAll={showAllTickets}
              tags={selectedTags}
              users={selectedUsers}
              selectedQueueIds={selectedQueueIds}
              whatsappIds={selectedWhatsapp}
              forceSearch={forceSearch}
              searchOnMessages={searchOnMessages}
              status="search"
            />
          </>
        )}

        {profile === "user" && (
          <TicketsList
            statusFilter={selectedStatus}
            searchParam={searchParam}
            showAll={false}
            tags={selectedTags}
            selectedQueueIds={selectedQueueIds}
            whatsappIds={selectedWhatsapp}
            forceSearch={forceSearch}
            searchOnMessages={searchOnMessages}
            status="search"
          />
        )}
      </TabPanel>
    </Paper >
  );
};

export default TicketsManagerTabs;
