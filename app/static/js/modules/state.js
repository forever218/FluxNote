export const state = {
    notes: [],
    currentTags: [],
    currentFilterTag: '',
    currentDateFilter: '',
    editNoteId: null,
    editTags: [],
    currentUser: null,
    currentPage: 1,
    isLoading: false,
    hasNextPage: true,
    galleryViewer: null,
    isTrashMode: false,
    sessionRevoked: false
};

export function setState(key, value) {
    state[key] = value;
}
